package com.sakaysugbo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Starts the Sakay Sugbo API.
 *
 * <p>What happens at start-up, in order:
 * <ol>
 *   <li>Spring creates the database tables from the entity classes.</li>
 *   <li>{@code GeoJsonImporter} fills them from the GeoJSON files, if they are empty.
 *       This finishes before the web server starts taking requests.</li>
 *   <li>The first request makes {@code RouteCatalog} read every route into memory once.</li>
 * </ol>
 */
@SpringBootApplication
public class SakaySugboApplication {

    public static void main(String[] args) {
        SpringApplication.run(SakaySugboApplication.class, args);
    }
}
