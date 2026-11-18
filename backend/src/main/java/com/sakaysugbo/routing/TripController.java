package com.sakaysugbo.routing;

import com.sakaysugbo.geo.LngLat;
import com.sakaysugbo.route.RouteCatalog;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final RouteCatalog catalog;
    /** Built on first use: preparing the planner looks at every pair of stops once. */
    private volatile TripPlanner planner;

    public TripController(RouteCatalog catalog) {
        this.catalog = catalog;
    }

    /**
     * {@code GET /api/trips?fromLat=..&fromLng=..&toLat=..&toLng=..}: ways to
     * make the trip, fewest changes first. When there is none, {@code options}
     * is empty and {@code reason} says why.
     */
    @GetMapping
    public TripResult trips(
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double fromLat,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double fromLng,
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double toLat,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double toLng) {
        return planner().findTrips(new LngLat(fromLng, fromLat), new LngLat(toLng, toLat));
    }

    private TripPlanner planner() {
        TripPlanner ready = planner;
        if (ready == null) {
            synchronized (this) {
                if (planner == null) {
                    planner = new TripPlanner(catalog.all());
                }
                ready = planner;
            }
        }
        return ready;
    }
}
