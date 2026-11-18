package com.sakaysugbo.routing;

import com.sakaysugbo.geo.GeoMath;
import com.sakaysugbo.geo.LngLat;
import com.sakaysugbo.route.RouteLine;
import java.util.ArrayList;
import java.util.List;

/**
 * Made-up routes used only by the unit tests. They are simple straight lines
 * so the expected answers are easy to work out by hand.
 * These are NOT real Cebu routes.
 */
public final class TestRoutes {

    private TestRoutes() {
    }

    /** Runs west to east along latitude 10.300, about 4.4 km. */
    public static final RouteLine EAST = route("EAST", "EAST",
            List.of(new LngLat(123.88, 10.3), new LngLat(123.92, 10.3)));

    /** Runs south to north along longitude 123.900, crossing EAST at (123.900, 10.300). */
    public static final RouteLine NORTH = route("NORTH", "NORTH",
            List.of(new LngLat(123.9, 10.29), new LngLat(123.9, 10.33)));

    /** A route with a stop every 250 m, starting at its first point. */
    public static RouteLine route(String id, String code, List<LngLat> coordinates) {
        return route(id, code, coordinates, stopsEvery(code, coordinates, 250));
    }

    public static RouteLine route(String id, String code, List<LngLat> coordinates,
            List<RouteLine.Stop> stops) {
        double[] cumulative = GeoMath.cumulativeMetres(coordinates);
        return RouteLine.of(id, code, null, null, code + " Terminal", null, null, null, null, "#ffffff",
                (int) Math.round(cumulative[cumulative.length - 1]),
                List.of(new RouteLine.Street(code + " Street", 0)), stops, 0, false, coordinates);
    }

    private static List<RouteLine.Stop> stopsEvery(String code, List<LngLat> coordinates, int spacingM) {
        double[] cumulative = GeoMath.cumulativeMetres(coordinates);
        double total = cumulative[cumulative.length - 1];
        List<RouteLine.Stop> stops = new ArrayList<>();
        int n = 1;
        for (int alongM = 0; alongM <= total; alongM += spacingM, n++) {
            LngLat p = GeoMath.sliceLine(coordinates, cumulative, alongM, alongM).getFirst();
            stops.add(new RouteLine.Stop(code + "-stop-" + n, code + " stop " + n, p.lng(), p.lat(), alongM));
        }
        return stops;
    }
}
