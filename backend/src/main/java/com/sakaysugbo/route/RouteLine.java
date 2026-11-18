package com.sakaysugbo.route;

import com.sakaysugbo.geo.GeoMath;
import com.sakaysugbo.geo.LngLat;
import java.util.List;

/**
 * One direction of travel of a jeepney route, held in memory and ready for
 * distance calculations. Built once from the database by {@link RouteCatalog}.
 *
 * <p>This is deliberately a plain record with no database annotations: the
 * "near this point" search and the trip finder work on it, so they can be
 * tested without a database.
 */
public record RouteLine(
        String id,
        String code,
        String name,
        String from,
        String to,
        String firstStopName,
        String lastStopName,
        String operator,
        String network,
        String colour,
        int lengthM,
        List<Street> streets,
        List<Stop> stops,
        long osmRelationId,
        boolean fieldVerified,
        List<LngLat> coordinates,
        double[] cumulativeM) {

    /** "From point number {@code fromIndex} onwards the route runs on this street." */
    public record Street(String name, int fromIndex) {
    }

    /** A mapped stop: where it is and how many metres along the route. */
    public record Stop(String id, String name, double lng, double lat, int alongM) {

        public LngLat position() {
            return new LngLat(lng, lat);
        }
    }

    /** Builds a route, working out the running distance along its line. */
    public static RouteLine of(String id, String code, String name, String from, String to,
            String firstStopName, String lastStopName, String operator, String network, String colour,
            int lengthM, List<Street> streets, List<Stop> stops, long osmRelationId, boolean fieldVerified,
            List<LngLat> coordinates) {
        return new RouteLine(id, code, name, from, to, firstStopName, lastStopName, operator, network, colour,
                lengthM, List.copyOf(streets), List.copyOf(stops), osmRelationId, fieldVerified,
                List.copyOf(coordinates), GeoMath.cumulativeMetres(coordinates));
    }

    /** The street the route is on at a given distance from its start, or null if unnamed. */
    public String streetAt(double alongM) {
        int index = GeoMath.indexAtDistance(cumulativeM, alongM);
        String name = null;
        for (Street street : streets) {
            if (street.fromIndex() > index) {
                break;
            }
            name = street.name();
        }
        return name;
    }
}
