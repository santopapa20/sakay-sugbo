package com.sakaysugbo.route;

import static org.assertj.core.api.Assertions.assertThat;

import com.sakaysugbo.geo.LngLat;
import com.sakaysugbo.routing.TestRoutes;
import java.util.List;
import org.junit.jupiter.api.Test;

class NearbyRoutesTest {

    // "close" runs along latitude 10.300; "far" runs along 10.350, about 5.5 km north.
    private static final RouteLine CLOSE = TestRoutes.route("close", "01A",
            List.of(new LngLat(123.88, 10.3), new LngLat(123.91, 10.3)));
    private static final RouteLine FAR = TestRoutes.route("far", "02B",
            List.of(new LngLat(123.88, 10.35), new LngLat(123.91, 10.35)));
    private static final List<RouteLine> ROUTES = List.of(CLOSE, FAR);

    @Test
    void returnsOnlyRoutesWithinTheRadius() {
        // About 110 m north of the first route.
        List<NearbyRoutes.Match> found = NearbyRoutes.find(ROUTES, new LngLat(123.895, 10.301), 300);
        assertThat(found).extracting(match -> match.route().id()).containsExactly("close");
        assertThat(found.getFirst().distanceM()).isBetween(100.0, 120.0);
    }

    @Test
    void respectsASmallerRadius() {
        assertThat(NearbyRoutes.find(ROUTES, new LngLat(123.895, 10.301), 50)).isEmpty();
    }

    @Test
    void sortsNearestFirst() {
        List<NearbyRoutes.Match> found = NearbyRoutes.find(ROUTES, new LngLat(123.895, 10.33), 5000);
        assertThat(found).extracting(match -> match.route().id()).containsExactly("far", "close");
    }

    @Test
    void measuresToTheLineNotOnlyToItsEnds() {
        // Beside the middle of the line, far from both end points.
        List<NearbyRoutes.Match> found = NearbyRoutes.find(ROUTES, new LngLat(123.895, 10.3002), 100);
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().alongM()).isBetween(1500.0, 1800.0);
    }
}
