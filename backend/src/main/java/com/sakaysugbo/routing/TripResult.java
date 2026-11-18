package com.sakaysugbo.routing;

import com.sakaysugbo.geo.LngLat;
import com.sakaysugbo.route.RouteLine;
import java.util.List;

/**
 * The answer to "how do I get from here to there?". These records are turned
 * into JSON as they are, and match the TypeScript types the frontend uses.
 */
public record TripResult(List<Option> options, String reason, double straightLineM) {

    /** Reasons no option was found. Sent as text so the screen can explain honestly. */
    public static final String TOO_CLOSE = "too-close";
    public static final String ORIGIN_NOT_SERVED = "origin-not-served";
    public static final String DESTINATION_NOT_SERVED = "destination-not-served";
    public static final String NO_CONNECTION = "no-connection";

    /** One way of making the trip: walk, ride, perhaps walk and ride again, walk. */
    public record Option(String id, List<Leg> legs, int transfers, double walkM, double rideM, double cost) {
    }

    /** A part of a trip: either a walk or a ride. {@code kind} says which. */
    public sealed interface Leg permits WalkLeg, RideLeg {
        String kind();

        double distanceM();
    }

    /** Straight-line distance; the real walk along streets is a little longer. */
    public record WalkLeg(String kind, LngLat from, LngLat to, double distanceM) implements Leg {
        public WalkLeg(LngLat from, LngLat to, double distanceM) {
            this("walk", from, to, distanceM);
        }
    }

    public record RideLeg(
            String kind,
            String routeId,
            String code,
            PointOnRoute board,
            PointOnRoute alight,
            double distanceM,
            List<double[]> coordinates,
            List<RouteLine.Stop> stopsBetween) implements Leg {
    }

    /** A mapped stop where you get on or off, and the street it is on if named. */
    public record PointOnRoute(double lng, double lat, double alongM, String street, RouteLine.Stop stop) {
        public LngLat position() {
            return new LngLat(lng, lat);
        }
    }
}
