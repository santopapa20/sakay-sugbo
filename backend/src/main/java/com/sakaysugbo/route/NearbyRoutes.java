package com.sakaysugbo.route;

import com.sakaysugbo.geo.GeoMath;
import com.sakaysugbo.geo.LngLat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Answers "which routes pass near this point?". Plain logic, no Spring. */
public final class NearbyRoutes {

    private NearbyRoutes() {
    }

    /** One route passing near a point. */
    public record Match(RouteLine route, double distanceM, double alongM) {
    }

    /**
     * Every route that comes within {@code radiusM} metres of {@code point},
     * nearest first. The distance is measured to the closest part of the
     * route's line, not just to its stops.
     */
    public static List<Match> find(List<RouteLine> routes, LngLat point, double radiusM) {
        List<Match> found = new ArrayList<>();
        for (RouteLine route : routes) {
            GeoMath.NearestOnLine nearest = GeoMath.nearestOnLine(point, route.coordinates(), route.cumulativeM());
            if (nearest != null && nearest.distanceM() <= radiusM) {
                found.add(new Match(route, nearest.distanceM(), nearest.alongM()));
            }
        }
        found.sort(Comparator.comparingDouble(Match::distanceM));
        return found;
    }
}
