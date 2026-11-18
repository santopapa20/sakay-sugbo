package com.sakaysugbo.importer;

import com.sakaysugbo.place.Place;
import com.sakaysugbo.place.PlaceRepository;
import com.sakaysugbo.route.Route;
import com.sakaysugbo.route.RouteCatalog;
import com.sakaysugbo.route.RouteRepository;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Fills the database from the GeoJSON files when the application starts,
 * but only if the tables are empty. Starting the application twice therefore
 * never creates duplicates.
 *
 * <p><b>Why this is not the usual {@code ApplicationRunner}:</b> runners start
 * only after the web server is already accepting requests. A request arriving
 * in that gap would find empty tables. Spring calls
 * {@link #afterSingletonsInstantiated()} earlier, once every component exists
 * but before the web server opens its port, so the data is always in place
 * before the first request. (This was found by running the server for real:
 * the first request came back with no routes.)
 *
 * <p>The files are the ones written by {@code tools/osm-import/import.mjs}
 * into {@code frontend/public/data/}. The build copies them onto the
 * classpath under {@code data/} (see the {@code <resources>} block in pom.xml),
 * so the frontend and the backend always read the same data.
 */
@Component
public class GeoJsonImporter implements SmartInitializingSingleton {

    private static final Logger log = LoggerFactory.getLogger(GeoJsonImporter.class);

    private final RouteRepository routes;
    private final PlaceRepository places;
    private final RouteCatalog catalog;
    private final TransactionTemplate transaction;
    private final JsonMapper json;

    public GeoJsonImporter(RouteRepository routes, PlaceRepository places, RouteCatalog catalog,
            TransactionTemplate transaction, JsonMapper json) {
        this.routes = routes;
        this.places = places;
        this.catalog = catalog;
        this.transaction = transaction;
        this.json = json;
    }

    @Override
    public void afterSingletonsInstantiated() {
        // One transaction: either everything is imported or, if a file is broken, nothing is.
        transaction.executeWithoutResult(status -> {
            try {
                if (routes.count() == 0) {
                    List<Route> imported = readRoutes();
                    routes.saveAll(imported);
                    log.info("Imported {} route directions from data/routes.geojson", imported.size());
                }
                if (places.count() == 0) {
                    List<Place> imported = readPlaces();
                    places.saveAll(imported);
                    log.info("Imported {} places from data/places.geojson", imported.size());
                }
            } catch (IOException e) {
                throw new IllegalStateException("Could not read the GeoJSON data files", e);
            }
        });
        // Only now, with the rows saved for good, may the in-memory copy be rebuilt.
        catalog.refresh();
    }

    private JsonNode features(String file) throws IOException {
        try (InputStream in = new ClassPathResource("data/" + file).getInputStream()) {
            return json.readTree(in).get("features");
        }
    }

    /** Text of a property, or null when it is missing or JSON null. */
    private static String text(JsonNode properties, String field) {
        JsonNode value = properties.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    private List<Route> readRoutes() throws IOException {
        List<Route> result = new ArrayList<>();
        for (JsonNode feature : features("routes.geojson")) {
            JsonNode p = feature.get("properties");

            List<Route.Point> points = new ArrayList<>();
            // GeoJSON stores each point as [longitude, latitude].
            for (JsonNode coordinate : feature.get("geometry").get("coordinates")) {
                points.add(new Route.Point(coordinate.get(1).asDouble(), coordinate.get(0).asDouble()));
            }
            List<Route.Stop> stops = new ArrayList<>();
            for (JsonNode stop : p.get("stops")) {
                stops.add(new Route.Stop(text(stop, "id"), text(stop, "name"),
                        stop.get("lat").asDouble(), stop.get("lng").asDouble(), stop.get("alongM").asInt()));
            }
            List<Route.Street> streets = new ArrayList<>();
            for (JsonNode street : p.get("streets")) {
                streets.add(new Route.Street(text(street, "name"), street.get("fromIndex").asInt()));
            }

            result.add(new Route(
                    text(p, "id"), text(p, "code"), text(p, "name"), text(p, "from"), text(p, "to"),
                    text(p, "firstStopName"), text(p, "lastStopName"), text(p, "operator"), text(p, "network"),
                    text(p, "colour"), p.get("lengthM").asInt(), p.get("osmRelationId").asLong(),
                    p.get("fieldVerified").asBoolean(), points, stops, streets));
        }
        return result;
    }

    private List<Place> readPlaces() throws IOException {
        List<Place> result = new ArrayList<>();
        for (JsonNode feature : features("places.geojson")) {
            JsonNode p = feature.get("properties");
            JsonNode coordinates = feature.get("geometry").get("coordinates");
            result.add(new Place(text(p, "id"), text(p, "name"), text(p, "category"), text(p, "address"),
                    coordinates.get(0).asDouble(), coordinates.get(1).asDouble()));
        }
        return result;
    }
}
