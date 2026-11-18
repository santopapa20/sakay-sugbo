package com.sakaysugbo.geo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import org.junit.jupiter.api.Test;

class GeoMathTest {

    // Two real Cebu landmarks, about 1.65 km apart in a straight line.
    private static final LngLat FUENTE_OSMENA = new LngLat(123.8931, 10.3095);
    private static final LngLat AYALA_CENTER = new LngLat(123.9054, 10.3181);

    // A straight west-to-east line along latitude 10.3, about 1.1 km long.
    private static final List<LngLat> LINE = List.of(
            new LngLat(123.89, 10.3), new LngLat(123.895, 10.3), new LngLat(123.9, 10.3));

    @Test
    void distanceToTheSamePointIsZero() {
        assertThat(GeoMath.haversineMetres(FUENTE_OSMENA, FUENTE_OSMENA)).isZero();
    }

    @Test
    void measuresAKnownCebuDistance() {
        assertThat(GeoMath.haversineMetres(FUENTE_OSMENA, AYALA_CENTER)).isBetween(1600.0, 1700.0);
    }

    @Test
    void givesTheSameAnswerInBothDirections() {
        assertThat(GeoMath.haversineMetres(FUENTE_OSMENA, AYALA_CENTER))
                .isCloseTo(GeoMath.haversineMetres(AYALA_CENTER, FUENTE_OSMENA), within(1e-6));
    }

    @Test
    void oneDegreeOfLatitudeIsAbout111Kilometres() {
        double metres = GeoMath.haversineMetres(new LngLat(123.9, 10), new LngLat(123.9, 11));
        assertThat(metres / 1000).isCloseTo(111.2, within(0.1));
    }

    @Test
    void cumulativeDistanceStartsAtZeroAndGrows() {
        double[] totals = GeoMath.cumulativeMetres(LINE);
        assertThat(totals[0]).isZero();
        assertThat(totals[1]).isGreaterThan(540);
        assertThat(totals[2]).isCloseTo(totals[1] * 2, within(1.0));
    }

    @Test
    void snapsAPointBesideTheLineOntoIt() {
        double[] totals = GeoMath.cumulativeMetres(LINE);
        // About 111 m north of the middle of the first segment.
        GeoMath.NearestOnLine nearest = GeoMath.nearestOnLine(new LngLat(123.8925, 10.301), LINE, totals);
        assertThat(nearest.point().lat()).isCloseTo(10.3, within(1e-5));
        assertThat(nearest.point().lng()).isCloseTo(123.8925, within(1e-4));
        assertThat(nearest.distanceM()).isBetween(105.0, 117.0);
        assertThat(nearest.alongM()).isCloseTo(totals[1] / 2, within(5.0));
    }

    @Test
    void clampsToTheEndWhenThePointIsPastTheLine() {
        double[] totals = GeoMath.cumulativeMetres(LINE);
        GeoMath.NearestOnLine nearest = GeoMath.nearestOnLine(new LngLat(123.91, 10.3), LINE, totals);
        assertThat(nearest.point().lng()).isCloseTo(123.9, within(1e-6));
        assertThat(nearest.alongM()).isCloseTo(totals[2], within(0.001));
    }

    @Test
    void aLineWithOnePointHasNoNearestPoint() {
        List<LngLat> single = List.of(new LngLat(123.89, 10.3));
        assertThat(GeoMath.nearestOnLine(FUENTE_OSMENA, single, GeoMath.cumulativeMetres(single))).isNull();
    }

    @Test
    void cutsOutTheMiddleOfALine() {
        double[] totals = GeoMath.cumulativeMetres(LINE);
        List<LngLat> piece = GeoMath.sliceLine(LINE, totals, 100, totals[2] - 100);
        assertThat(piece.getFirst().lng()).isGreaterThan(123.89);
        assertThat(piece.getLast().lng()).isLessThan(123.9);
        assertThat(piece).contains(new LngLat(123.895, 10.3));
        double length = GeoMath.cumulativeMetres(piece)[piece.size() - 1];
        assertThat(length).isCloseTo(totals[2] - 200, within(1.0));
    }
}
