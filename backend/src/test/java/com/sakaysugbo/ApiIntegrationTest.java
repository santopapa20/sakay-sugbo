package com.sakaysugbo;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Starts the whole application against the in-memory database, lets it import
 * the real GeoJSON files, and calls the endpoints the way the frontend does.
 *
 * <p>The expected numbers (74 route directions and so on) come from the data
 * snapshot in frontend/public/data/. If the data is refreshed and a count
 * changes, update the number here.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

    // Fuente Osmeña Circle, a roundabout in the middle of Cebu City.
    private static final String FUENTE = "lat=10.3095&lng=123.8931";

    @Autowired
    private MockMvc mvc;

    @Test
    void listsEveryRouteWithItsLineAndStops() throws Exception {
        mvc.perform(get("/api/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(74)))
                .andExpect(jsonPath("$[0].code").value("01B"))
                .andExpect(jsonPath("$[0].coordinates.length()", greaterThan(50)))
                .andExpect(jsonPath("$[0].coordinates[0]", hasSize(2)))
                .andExpect(jsonPath("$[0].stops.length()", greaterThan(5)))
                .andExpect(jsonPath("$[0].fieldVerified").value(false))
                .andExpect(jsonPath("$[*].code", hasItem("13C")));
    }

    @Test
    void findsRoutesNearAPoint() throws Exception {
        mvc.perform(get("/api/routes/near?" + FUENTE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", greaterThan(0)))
                // The default radius is 300 m, and results come nearest first.
                .andExpect(jsonPath("$[*].distanceM", everyItem(lessThanOrEqualTo(300.0))))
                .andExpect(jsonPath("$[0].routeId").exists())
                .andExpect(jsonPath("$[0].code").exists());
    }

    @Test
    void aSmallerRadiusFindsNoMoreRoutesThanALargerOne() throws Exception {
        mvc.perform(get("/api/routes/near?" + FUENTE + "&radius=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void findsNothingFarOutAtSea() throws Exception {
        mvc.perform(get("/api/routes/near?lat=10.20&lng=124.05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void rejectsAMissingOrImpossibleCoordinate() throws Exception {
        mvc.perform(get("/api/routes/near?lat=10.3")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/routes/near?lat=95&lng=123.9")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/routes/near?" + FUENTE + "&radius=0")).andExpect(status().isBadRequest());
    }

    @Test
    void listsPlacesAndFiltersByCategory() throws Exception {
        mvc.perform(get("/api/places"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", greaterThan(2000)));
        mvc.perform(get("/api/places?category=hospital"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", greaterThan(10)))
                .andExpect(jsonPath("$[*].category", everyItem(org.hamcrest.Matchers.is("hospital"))));
    }

    @Test
    void findsATripBetweenTwoPlacesInTheCity() throws Exception {
        // From SM City Cebu to Colon Street, both well served by mapped routes.
        mvc.perform(get("/api/trips?fromLat=10.3118&fromLng=123.9183&toLat=10.2972&toLng=123.8990"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reason").doesNotExist())
                .andExpect(jsonPath("$.options.length()", greaterThan(0)))
                .andExpect(jsonPath("$.options[0].legs[0].kind").value("walk"))
                .andExpect(jsonPath("$.options[0].legs[1].kind").value("ride"))
                .andExpect(jsonPath("$.options[0].legs[1].board.stop.id").exists());
    }

    @Test
    void explainsWhyThereIsNoTrip() throws Exception {
        mvc.perform(get("/api/trips?fromLat=10.20&fromLng=124.05&toLat=10.2972&toLng=123.8990"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options", hasSize(0)))
                .andExpect(jsonPath("$.reason").value("origin-not-served"));
    }

    @Test
    void servesTheFactsAboutTheData() throws Exception {
        mvc.perform(get("/api/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fieldVerified").value(false))
                .andExpect(jsonPath("$.counts.routeDirections").value(74));
    }
}
