package com.sakaysugbo.route;

import com.sakaysugbo.geo.LngLat;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Every route, read from the database once and then kept in memory.
 *
 * <p>Why keep them in memory: there are only a few dozen routes, they change
 * only when the data is re-imported, and "which routes pass near this point?"
 * needs every point of every route. Reading them once avoids thousands of
 * database rows being fetched on every tap of the map.
 */
@Component
public class RouteCatalog {

    private final RouteRepository repository;
    private final TransactionTemplate transaction;
    /** null until the first request; volatile so every thread sees the loaded list. */
    private volatile List<RouteLine> routes;

    public RouteCatalog(RouteRepository repository, TransactionTemplate transaction) {
        this.repository = repository;
        this.transaction = transaction;
    }

    public List<RouteLine> all() {
        List<RouteLine> loaded = routes;
        if (loaded == null) {
            synchronized (this) {
                if (routes == null) {
                    // The points, stops and streets are fetched lazily, which needs an open transaction.
                    routes = transaction.execute(status -> repository.findAll().stream()
                            .map(RouteCatalog::toRouteLine)
                            .sorted(Comparator.comparing(RouteLine::code).thenComparing(RouteLine::osmRelationId))
                            .toList());
                }
                loaded = routes;
            }
        }
        return loaded;
    }

    public Optional<RouteLine> byId(String id) {
        return all().stream().filter(route -> route.id().equals(id)).findFirst();
    }

    /** Forgets the in-memory copy, so the next request reads the database again. */
    public void refresh() {
        routes = null;
    }

    private static RouteLine toRouteLine(Route route) {
        return RouteLine.of(
                route.getId(), route.getCode(), route.getName(), route.getFrom(), route.getTo(),
                route.getFirstStopName(), route.getLastStopName(), route.getOperator(), route.getNetwork(),
                route.getColour(), route.getLengthM(),
                route.getStreets().stream().map(s -> new RouteLine.Street(s.name(), s.fromIndex())).toList(),
                route.getStops().stream()
                        .map(s -> new RouteLine.Stop(s.osmId(), s.name(), s.longitude(), s.latitude(), s.alongM()))
                        .toList(),
                route.getOsmRelationId(), route.isFieldVerified(),
                route.getPoints().stream().map(p -> new LngLat(p.longitude(), p.latitude())).toList());
    }
}
