package com.sakaysugbo.route;

import com.sakaysugbo.geo.LngLat;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The route endpoints. The JSON matches the frontend's {@code RouteDirection} type. */
@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteCatalog catalog;

    public RouteController(RouteCatalog catalog) {
        this.catalog = catalog;
    }

    /** One route direction as JSON. Coordinates are [longitude, latitude] pairs, as in GeoJSON. */
    public record RouteResponse(
            String id, String code, String name, String from, String to, String firstStopName,
            String lastStopName, String operator, String network, String colour, int lengthM,
            List<RouteLine.Street> streets, List<RouteLine.Stop> stops, long osmRelationId,
            boolean fieldVerified, List<double[]> coordinates) {

        static RouteResponse from(RouteLine route) {
            return new RouteResponse(route.id(), route.code(), route.name(), route.from(), route.to(),
                    route.firstStopName(), route.lastStopName(), route.operator(), route.network(),
                    route.colour(), route.lengthM(), route.streets(), route.stops(), route.osmRelationId(),
                    route.fieldVerified(),
                    route.coordinates().stream().map(p -> new double[] {p.lng(), p.lat()}).toList());
        }
    }

    /** A route passing near a point: how far away, and where along the route. */
    public record NearbyRouteResponse(String routeId, String code, double distanceM, double alongM,
            String street) {
    }

    /** {@code GET /api/routes}: every route direction with its line and stops. */
    @GetMapping
    public List<RouteResponse> all() {
        return catalog.all().stream().map(RouteResponse::from).toList();
    }

    /**
     * {@code GET /api/routes/near?lat=10.3095&lng=123.8931&radius=300}: routes
     * passing within {@code radius} metres of the point, nearest first.
     * A missing or out-of-range value gets a 400 Bad Request from Spring.
     */
    @GetMapping("/near")
    public List<NearbyRouteResponse> near(
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double lng,
            @RequestParam(defaultValue = "300") @DecimalMin("1") @DecimalMax("5000") double radius) {
        return NearbyRoutes.find(catalog.all(), new LngLat(lng, lat), radius).stream()
                .map(match -> new NearbyRouteResponse(match.route().id(), match.route().code(),
                        match.distanceM(), match.alongM(), match.route().streetAt(match.alongM())))
                .toList();
    }
}
