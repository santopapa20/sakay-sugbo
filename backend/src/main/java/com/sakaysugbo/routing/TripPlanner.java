package com.sakaysugbo.routing;

import com.sakaysugbo.geo.GeoMath;
import com.sakaysugbo.geo.LngLat;
import com.sakaysugbo.route.RouteLine;
import com.sakaysugbo.routing.TripResult.Leg;
import com.sakaysugbo.routing.TripResult.Option;
import com.sakaysugbo.routing.TripResult.PointOnRoute;
import com.sakaysugbo.routing.TripResult.RideLeg;
import com.sakaysugbo.routing.TripResult.WalkLeg;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The trip finder: "which jeepney do I ride from here to there?"
 *
 * <p>How it works, in plain words:
 * <ol>
 *   <li>Each route can be boarded or left only at its mapped stops. (A point
 *       picked anywhere on the line could be on a flyover, where no jeepney
 *       can stop.)</li>
 *   <li>Find the stops within walking distance of the start and of the destination.</li>
 *   <li>DIRECT RIDE: a route with a stop near the start and, further along in
 *       its direction of travel, a stop near the destination.</li>
 *   <li>ONE TRANSFER: a route A near the start and a route B near the
 *       destination that have stops within 150 m of each other, after you
 *       board A and before you get off B.</li>
 *   <li>Rank by fewest transfers, then by a "cost" in which a metre walked
 *       counts as four metres ridden.</li>
 * </ol>
 *
 * <p>It only uses mapped routes and stops. If they do not connect two places
 * it says so instead of guessing.
 *
 * <p>This is a port of {@code frontend/src/features/trip/tripPlanner.ts} and
 * must give the same answers. It has no Spring and no database in it.
 */
public final class TripPlanner {

    /** How far we assume someone will walk to reach or leave a jeepney. */
    static final double MAX_WALK_M = 500;
    /** Two stops this close together count as a place to change jeepneys. */
    static final double TRANSFER_RADIUS_M = 150;
    /** One metre walked "costs" as much as this many metres ridden. */
    static final double WALK_WEIGHT = 4;
    /** Changing jeepneys costs as much as riding this many extra metres. */
    static final double TRANSFER_PENALTY_M = 1500;
    /** A ride shorter than this is not worth boarding for. */
    static final double MIN_RIDE_M = 300;
    /** Start and destination closer than this: just walk. */
    static final double WALKABLE_M = 250;
    static final int MAX_OPTIONS = 5;

    /** A stop of one route, in travel order. */
    private record BoardingPoint(RouteLine.Stop stop, LngLat position, double alongM) {
    }

    /** A boarding point near the start or destination, and how far away it is. */
    private record Near(int index, double distanceM) {
    }

    /** A stop on another route close enough to change to. */
    private record TransferLink(int route, int index, double distanceM) {
    }

    /** "The best choice so far": which stop, and its score. */
    private record Best(int index, double value) {
    }

    private record DirectCandidate(int route, int board, int alight, double cost) {
    }

    private record TransferCandidate(int first, int board, int leave, int second, int join, int alight,
            double cost) {
    }

    private final List<RouteLine> routes;
    /** For each route, its boarding points. */
    private final List<List<BoardingPoint>> points;
    /** For each route and each of its boarding points, the stops of OTHER codes within reach. */
    private final List<List<List<TransferLink>>> transferLinks;

    public TripPlanner(List<RouteLine> routes) {
        this.routes = List.copyOf(routes);
        this.points = this.routes.stream().map(TripPlanner::boardingPoints).toList();
        this.transferLinks = buildTransferLinks();
    }

    /** The places where a route can be boarded or left: its mapped stops, in travel order. */
    private static List<BoardingPoint> boardingPoints(RouteLine route) {
        List<BoardingPoint> result = new ArrayList<>();
        double furthest = Double.NEGATIVE_INFINITY;
        for (RouteLine.Stop stop : route.stops()) {
            // A stop that appears to lie "behind" the previous one is out of order in
            // the data. Skip it rather than guess where on the line it belongs.
            if (stop.alongM() <= furthest) {
                continue;
            }
            result.add(new BoardingPoint(stop, stop.position(), stop.alongM()));
            furthest = stop.alongM();
        }
        return result;
    }

    /**
     * Works out, once, which stops are close enough to each other to change
     * between. Doing this up front keeps each trip search fast.
     */
    private List<List<List<TransferLink>>> buildTransferLinks() {
        List<List<List<TransferLink>>> all = new ArrayList<>();
        for (int a = 0; a < routes.size(); a++) {
            List<List<TransferLink>> perPoint = new ArrayList<>();
            for (BoardingPoint from : points.get(a)) {
                List<TransferLink> links = new ArrayList<>();
                for (int b = 0; b < routes.size(); b++) {
                    // Changing to another direction of the same code gets you nowhere new.
                    if (b == a || routes.get(b).code().equals(routes.get(a).code())) {
                        continue;
                    }
                    List<BoardingPoint> others = points.get(b);
                    for (int j = 0; j < others.size(); j++) {
                        double distance = GeoMath.haversineMetres(from.position(), others.get(j).position());
                        if (distance <= TRANSFER_RADIUS_M) {
                            links.add(new TransferLink(b, j, distance));
                        }
                    }
                }
                perPoint.add(links);
            }
            all.add(perPoint);
        }
        return all;
    }

    // ------------------------------------------------------------------ search

    public TripResult findTrips(LngLat origin, LngLat destination) {
        double straightLineM = GeoMath.haversineMetres(origin, destination);
        if (straightLineM < WALKABLE_M) {
            return new TripResult(List.of(), TripResult.TOO_CLOSE, straightLineM);
        }
        Map<Integer, List<Near>> nearOrigin = stopsWithinWalk(origin);
        if (nearOrigin.isEmpty()) {
            return new TripResult(List.of(), TripResult.ORIGIN_NOT_SERVED, straightLineM);
        }
        Map<Integer, List<Near>> nearDestination = stopsWithinWalk(destination);
        if (nearDestination.isEmpty()) {
            return new TripResult(List.of(), TripResult.DESTINATION_NOT_SERVED, straightLineM);
        }

        List<Option> direct = new ArrayList<>();
        for (DirectCandidate c : findDirect(nearOrigin, nearDestination)) {
            RideLeg ride = rideLeg(c.route(), c.board(), c.alight());
            direct.add(toOption(List.of(
                    walkLeg(origin, ride.board().position()),
                    ride,
                    walkLeg(ride.alight().position(), destination)), c.cost()));
        }
        List<Option> transfer = new ArrayList<>();
        for (TransferCandidate c : findOneTransfer(nearOrigin, nearDestination)) {
            RideLeg first = rideLeg(c.first(), c.board(), c.leave());
            RideLeg second = rideLeg(c.second(), c.join(), c.alight());
            transfer.add(toOption(List.of(
                    walkLeg(origin, first.board().position()),
                    first,
                    walkLeg(first.alight().position(), second.board().position()),
                    second,
                    walkLeg(second.alight().position(), destination)), c.cost()));
        }

        List<Option> options = new ArrayList<>(direct);
        options.addAll(withoutPointlessTransfers(direct, transfer));

        // Fewest changes, then cheapest. Equal costs are ordered by code so the
        // answer is always the same, here and in the TypeScript version.
        List<Option> ranked = bestPerCodeSequence(options).stream()
                .sorted(Comparator.comparingInt(Option::transfers)
                        .thenComparingLong(option -> Math.round(option.cost()))
                        .thenComparing(TripPlanner::codeSequence))
                .limit(MAX_OPTIONS)
                .toList();
        return new TripResult(ranked, ranked.isEmpty() ? TripResult.NO_CONNECTION : null, straightLineM);
    }

    /**
     * Stops within walking distance of a trip end, grouped by route.
     *
     * <p>A big place such as a university campus is stored as one point in its
     * middle, which can be further than the normal walk from any road. So when
     * nothing is within the normal distance we look once more at double the
     * distance. The longer walk is then shown to the user, not hidden.
     */
    private Map<Integer, List<Near>> stopsWithinWalk(LngLat point) {
        Map<Integer, List<Near>> near = stopsNear(point, MAX_WALK_M);
        return near.isEmpty() ? stopsNear(point, MAX_WALK_M * 2) : near;
    }

    private Map<Integer, List<Near>> stopsNear(LngLat point, double radiusM) {
        Map<Integer, List<Near>> found = new LinkedHashMap<>();
        for (int r = 0; r < routes.size(); r++) {
            List<BoardingPoint> stops = points.get(r);
            for (int i = 0; i < stops.size(); i++) {
                double distance = GeoMath.haversineMetres(point, stops.get(i).position());
                if (distance <= radiusM) {
                    found.computeIfAbsent(r, key -> new ArrayList<>()).add(new Near(i, distance));
                }
            }
        }
        return found;
    }

    private List<DirectCandidate> findDirect(Map<Integer, List<Near>> nearOrigin,
            Map<Integer, List<Near>> nearDestination) {
        List<DirectCandidate> candidates = new ArrayList<>();
        for (var entry : nearOrigin.entrySet()) {
            int route = entry.getKey();
            List<Near> alights = nearDestination.get(route);
            if (alights == null) {
                continue;
            }
            List<BoardingPoint> stops = points.get(route);
            DirectCandidate best = null;
            for (Near board : entry.getValue()) {
                for (Near alight : alights) {
                    double rideM = stops.get(alight.index()).alongM() - stops.get(board.index()).alongM();
                    // The destination must come AFTER the boarding stop: jeepneys do not reverse.
                    if (rideM < MIN_RIDE_M) {
                        continue;
                    }
                    double cost = WALK_WEIGHT * (board.distanceM() + alight.distanceM()) + rideM;
                    if (best == null || cost < best.cost()) {
                        best = new DirectCandidate(route, board.index(), alight.index(), cost);
                    }
                }
            }
            if (best != null) {
                candidates.add(best);
            }
        }
        return candidates;
    }

    private List<TransferCandidate> findOneTransfer(Map<Integer, List<Near>> nearOrigin,
            Map<Integer, List<Near>> nearDestination) {
        // For each route that reaches the destination: at every stop, the cheapest
        // stop to get off at or after it. Worked out once per route, back to front.
        Map<Integer, Best[]> bestAlightFrom = new LinkedHashMap<>();
        for (var entry : nearDestination.entrySet()) {
            List<BoardingPoint> stops = points.get(entry.getKey());
            Map<Integer, Double> walkByIndex = entry.getValue().stream()
                    .collect(Collectors.toMap(Near::index, Near::distanceM));
            Best[] table = new Best[stops.size()];
            Best best = null;
            for (int i = stops.size() - 1; i >= 0; i--) {
                Double walk = walkByIndex.get(i);
                if (walk != null) {
                    double value = WALK_WEIGHT * walk + stops.get(i).alongM();
                    if (best == null || value < best.value()) {
                        best = new Best(i, value);
                    }
                }
                table[i] = best;
            }
            bestAlightFrom.put(entry.getKey(), table);
        }

        Map<String, TransferCandidate> bestPerPair = new LinkedHashMap<>();
        for (var entry : nearOrigin.entrySet()) {
            int first = entry.getKey();
            List<BoardingPoint> firstStops = points.get(first);
            Map<Integer, Double> walkByIndex = entry.getValue().stream()
                    .collect(Collectors.toMap(Near::index, Near::distanceM));
            // Going forward along the first route, remember the cheapest stop to have boarded at.
            Best bestBoard = null;

            for (int leave = 0; leave < firstStops.size(); leave++) {
                BoardingPoint here = firstStops.get(leave);
                Double walk = walkByIndex.get(leave);
                if (walk != null) {
                    double value = WALK_WEIGHT * walk - here.alongM();
                    if (bestBoard == null || value < bestBoard.value()) {
                        bestBoard = new Best(leave, value);
                    }
                }
                if (bestBoard == null
                        || here.alongM() - firstStops.get(bestBoard.index()).alongM() < MIN_RIDE_M) {
                    continue;
                }

                for (TransferLink link : transferLinks.get(first).get(leave)) {
                    Best[] alightTable = bestAlightFrom.get(link.route());
                    if (alightTable == null) {
                        continue; // that route never reaches the destination
                    }
                    Best alight = alightTable[link.index()];
                    if (alight == null) {
                        continue;
                    }
                    List<BoardingPoint> secondStops = points.get(link.route());
                    double joinAlongM = secondStops.get(link.index()).alongM();
                    if (secondStops.get(alight.index()).alongM() - joinAlongM < MIN_RIDE_M) {
                        continue;
                    }
                    double cost = bestBoard.value() + here.alongM() // walk to board + first ride
                            + WALK_WEIGHT * link.distanceM()
                            + TRANSFER_PENALTY_M
                            + (alight.value() - joinAlongM); // second ride + walk to destination

                    String key = first + ":" + link.route();
                    TransferCandidate known = bestPerPair.get(key);
                    if (known == null || cost < known.cost()) {
                        bestPerPair.put(key, new TransferCandidate(
                                first, bestBoard.index(), leave, link.route(), link.index(), alight.index(), cost));
                    }
                }
            }
        }
        return new ArrayList<>(bestPerPair.values());
    }

    // ------------------------------------------------------------ leg builders

    private PointOnRoute pointOnRoute(int route, int index) {
        BoardingPoint point = points.get(route).get(index);
        return new PointOnRoute(point.position().lng(), point.position().lat(), point.alongM(),
                routes.get(route).streetAt(point.alongM()), point.stop());
    }

    private RideLeg rideLeg(int routeIndex, int boardIndex, int alightIndex) {
        RouteLine route = routes.get(routeIndex);
        PointOnRoute board = pointOnRoute(routeIndex, boardIndex);
        PointOnRoute alight = pointOnRoute(routeIndex, alightIndex);
        List<double[]> coordinates = GeoMath
                .sliceLine(route.coordinates(), route.cumulativeM(), board.alongM(), alight.alongM()).stream()
                .map(p -> new double[] {p.lng(), p.lat()})
                .toList();
        List<RouteLine.Stop> between = route.stops().stream()
                .filter(stop -> stop.alongM() > board.alongM() && stop.alongM() < alight.alongM())
                .toList();
        return new RideLeg("ride", route.id(), route.code(), board, alight,
                alight.alongM() - board.alongM(), coordinates, between);
    }

    private static WalkLeg walkLeg(LngLat from, LngLat to) {
        return new WalkLeg(from, to, GeoMath.haversineMetres(from, to));
    }

    private static Option toOption(List<Leg> legs, double cost) {
        List<RideLeg> rides = rides(legs);
        String id = rides.stream()
                .map(ride -> ride.routeId() + "@" + Math.round(ride.board().alongM()))
                .collect(Collectors.joining(">"));
        double walkM = legs.stream().filter(leg -> leg instanceof WalkLeg).mapToDouble(Leg::distanceM).sum();
        double rideM = rides.stream().mapToDouble(RideLeg::distanceM).sum();
        return new Option(id, legs, rides.size() - 1, walkM, rideM, cost);
    }

    private static List<RideLeg> rides(List<Leg> legs) {
        return legs.stream().filter(RideLeg.class::isInstance).map(RideLeg.class::cast).toList();
    }

    /** The jeepney codes of an option in riding order, e.g. "04L>13C". */
    private static String codeSequence(Option option) {
        return rides(option.legs()).stream().map(RideLeg::code).collect(Collectors.joining(">"));
    }

    /**
     * Drops trips with a change that use a route which already goes all the way.
     * If 04B takes you there directly, "06B then 04B" only adds a change.
     */
    private static List<Option> withoutPointlessTransfers(List<Option> direct, List<Option> transfer) {
        List<String> directCodes = direct.stream().map(TripPlanner::codeSequence).toList();
        return transfer.stream()
                .filter(option -> rides(option.legs()).stream().noneMatch(ride -> directCodes.contains(ride.code())))
                .toList();
    }

    /** Keeps the cheapest option for each sequence of jeepney codes ("04L then 13C"). */
    private static List<Option> bestPerCodeSequence(List<Option> options) {
        Map<String, Option> best = new LinkedHashMap<>();
        for (Option option : options) {
            String key = codeSequence(option);
            Option known = best.get(key);
            if (known == null || option.cost() < known.cost()) {
                best.put(key, option);
            }
        }
        return new ArrayList<>(best.values());
    }
}
