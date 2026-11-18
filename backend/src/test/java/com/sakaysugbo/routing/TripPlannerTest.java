package com.sakaysugbo.routing;

import static com.sakaysugbo.routing.TestRoutes.EAST;
import static com.sakaysugbo.routing.TestRoutes.NORTH;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.sakaysugbo.geo.LngLat;
import com.sakaysugbo.route.RouteLine;
import com.sakaysugbo.routing.TripResult.Leg;
import com.sakaysugbo.routing.TripResult.Option;
import com.sakaysugbo.routing.TripResult.RideLeg;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The same cases as frontend/src/features/trip/tripPlanner.test.ts. */
class TripPlannerTest {

    private static final LngLat WEST_END = new LngLat(123.885, 10.3005);
    private static final LngLat EAST_END = new LngLat(123.915, 10.3005);
    private static final LngLat NORTH_END = new LngLat(123.9005, 10.325);

    private final TripPlanner planner = new TripPlanner(List.of(EAST, NORTH));

    private static List<RideLeg> rides(Option option) {
        return option.legs().stream().filter(RideLeg.class::isInstance).map(RideLeg.class::cast).toList();
    }

    private static List<String> kinds(Option option) {
        return option.legs().stream().map(Leg::kind).toList();
    }

    @Test
    void findsADirectRideInTheDirectionOfTravel() {
        TripResult result = planner.findTrips(WEST_END, EAST_END);
        assertThat(result.reason()).isNull();
        assertThat(result.options()).hasSize(1);

        Option option = result.options().getFirst();
        assertThat(option.transfers()).isZero();
        assertThat(kinds(option)).containsExactly("walk", "ride", "walk");

        RideLeg ride = rides(option).getFirst();
        assertThat(ride.code()).isEqualTo("EAST");
        // Stops are 250 m apart, so the nearest one is within about 125 m of each end.
        assertThat(ride.board().lng()).isCloseTo(WEST_END.lng(), within(0.005));
        assertThat(ride.alight().lng()).isCloseTo(EAST_END.lng(), within(0.005));
        assertThat(ride.board().street()).isEqualTo("EAST Street");
        assertThat(option.rideM()).isBetween(3000.0, 3600.0);
        assertThat(option.walkM()).isLessThan(350);
    }

    @Test
    void boardsAndLeavesOnlyAtMappedStops() {
        RideLeg ride = rides(planner.findTrips(WEST_END, EAST_END).options().getFirst()).getFirst();
        List<String> stopIds = EAST.stops().stream().map(RouteLine.Stop::id).toList();
        assertThat(stopIds).contains(ride.board().stop().id(), ride.alight().stop().id());
        assertThat(ride.board().alongM() % 250).isZero();
    }

    @Test
    void doesNotSendAJeepneyBackwardsAlongItsRoute() {
        TripResult result = planner.findTrips(EAST_END, WEST_END);
        assertThat(result.options()).isEmpty();
        assertThat(result.reason()).isEqualTo(TripResult.NO_CONNECTION);
    }

    @Test
    void findsATripWithOneTransferWhereTwoRoutesCross() {
        TripResult result = planner.findTrips(WEST_END, NORTH_END);
        assertThat(result.options()).hasSize(1);
        Option option = result.options().getFirst();
        assertThat(option.transfers()).isEqualTo(1);
        assertThat(kinds(option)).containsExactly("walk", "ride", "walk", "ride", "walk");

        List<RideLeg> rides = rides(option);
        assertThat(rides.get(0).code()).isEqualTo("EAST");
        assertThat(rides.get(1).code()).isEqualTo("NORTH");
        // The change happens at the crossing, near (123.900, 10.300).
        assertThat(rides.get(0).alight().lng()).isCloseTo(123.9, within(0.005));
        assertThat(rides.get(1).board().lat()).isCloseTo(10.3, within(0.005));
        assertThat(rides.get(1).alight().lat()).isCloseTo(NORTH_END.lat(), within(0.005));
        assertThat(option.legs().get(2).distanceM()).isLessThan(150);
    }

    @Test
    void listsADirectRideBeforeATripWithATransfer() {
        // LOOP reaches the same destination as EAST + NORTH without changing.
        RouteLine loop = TestRoutes.route("LOOP", "LOOP", List.of(
                new LngLat(123.885, 10.301), new LngLat(123.885, 10.326), new LngLat(123.9, 10.326)));
        TripResult result = new TripPlanner(List.of(EAST, NORTH, loop)).findTrips(WEST_END, NORTH_END);
        assertThat(result.options().size()).isGreaterThanOrEqualTo(2);
        assertThat(result.options().get(0).transfers()).isZero();
        assertThat(rides(result.options().get(0)).getFirst().code()).isEqualTo("LOOP");
        assertThat(result.options().get(1).transfers()).isEqualTo(1);
    }

    @Test
    void doesNotSuggestAChangeWhenOneOfTheRoutesAlreadyGoesDirect() {
        // FEED starts near the western end and meets EAST after 500 m. Without the
        // rule, "FEED then EAST" would be offered next to the direct EAST ride.
        RouteLine feed = TestRoutes.route("FEED", "FEED",
                List.of(new LngLat(123.886, 10.304), new LngLat(123.89, 10.3003)));
        TripResult result = new TripPlanner(List.of(EAST, feed)).findTrips(WEST_END, EAST_END);
        assertThat(result.options()).hasSize(1);
        assertThat(rides(result.options().getFirst())).extracting(RideLeg::code).containsExactly("EAST");
    }

    @Test
    void neverOffersATransferBetweenTwoDirectionsOfTheSameCode() {
        RouteLine northAgain = TestRoutes.route("EAST-variant", "EAST", NORTH.coordinates());
        TripResult result = new TripPlanner(List.of(EAST, northAgain)).findTrips(WEST_END, NORTH_END);
        assertThat(result.options()).isEmpty();
    }

    @Test
    void cannotUseARouteThatHasNoMappedStops() {
        RouteLine noStops = TestRoutes.route("EAST", "EAST", EAST.coordinates(), List.of());
        assertThat(new TripPlanner(List.of(noStops)).findTrips(WEST_END, EAST_END).reason())
                .isEqualTo(TripResult.ORIGIN_NOT_SERVED);
    }

    @Test
    void ignoresAStopThatIsListedOutOfOrder() {
        List<RouteLine.Stop> stops = new ArrayList<>(EAST.stops());
        RouteLine.Stop second = stops.get(1);
        // The second stop claims to be "behind" the first: bad data.
        stops.set(1, new RouteLine.Stop(second.id(), second.name(), second.lng(), second.lat(), -50));
        RouteLine jumbled = TestRoutes.route("EAST", "EAST", EAST.coordinates(), stops);
        RideLeg ride = rides(new TripPlanner(List.of(jumbled)).findTrips(WEST_END, EAST_END)
                .options().getFirst()).getFirst();
        assertThat(ride.board().stop().id()).isNotEqualTo(second.id());
    }

    @Test
    void saysWhichEndHasNoJeepneyNearby() {
        LngLat farAway = new LngLat(123.95, 10.4);
        assertThat(planner.findTrips(farAway, EAST_END).reason()).isEqualTo(TripResult.ORIGIN_NOT_SERVED);
        assertThat(planner.findTrips(WEST_END, farAway).reason()).isEqualTo(TripResult.DESTINATION_NOT_SERVED);
    }

    @Test
    void acceptsALongerWalkWhenNothingIsWithinTheNormalDistance() {
        // About 780 m north of EAST: beyond the usual 500 m, inside the 1 km fallback.
        TripResult result = planner.findTrips(WEST_END, new LngLat(123.915, 10.307));
        assertThat(result.reason()).isNull();
        assertThat(result.options().getFirst().walkM()).isGreaterThan(700);
    }

    @Test
    void suggestsWalkingWhenTheTwoPointsAreVeryClose() {
        TripResult result = planner.findTrips(WEST_END, new LngLat(WEST_END.lng() + 0.001, WEST_END.lat()));
        assertThat(result.reason()).isEqualTo(TripResult.TOO_CLOSE);
        assertThat(result.straightLineM()).isLessThan(250);
    }

    @Test
    void countsTheMappedStopsPassedDuringARide() {
        RideLeg ride = rides(planner.findTrips(WEST_END, EAST_END).options().getFirst()).getFirst();
        int expected = (int) ((ride.alight().alongM() - ride.board().alongM()) / 250) - 1;
        assertThat(ride.stopsBetween()).hasSize(expected);
    }
}
