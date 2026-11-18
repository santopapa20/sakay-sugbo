package com.sakaysugbo.geo;

import java.util.ArrayList;
import java.util.List;

/**
 * Small geographic calculations. No Spring and no database here, which keeps
 * them easy to test. They mirror {@code frontend/src/utils/geo.ts} exactly.
 */
public final class GeoMath {

    private static final double EARTH_RADIUS_M = 6_371_000;

    private GeoMath() {
    }

    /**
     * Distance in metres between two points on the Earth's surface (the
     * "haversine" formula). Accurate to well under a metre at city scale.
     */
    public static double haversineMetres(LngLat a, LngLat b) {
        double dLat = Math.toRadians(b.lat() - a.lat());
        double dLng = Math.toRadians(b.lng() - a.lng());
        double h = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(a.lat())) * Math.cos(Math.toRadians(b.lat()))
                * Math.pow(Math.sin(dLng / 2), 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
    }

    /** Running total of a line's length: one number per point, starting at 0. */
    public static double[] cumulativeMetres(List<LngLat> line) {
        double[] totals = new double[line.size()];
        for (int i = 1; i < line.size(); i++) {
            totals[i] = totals[i - 1] + haversineMetres(line.get(i - 1), line.get(i));
        }
        return totals;
    }

    /** The result of {@link #nearestOnLine}. */
    public record NearestOnLine(LngLat point, double distanceM, double alongM) {
    }

    /**
     * Finds the point on a line closest to {@code target}, or null for a line
     * with fewer than two points.
     *
     * <p>Works segment by segment. Over a few hundred metres the Earth is close
     * enough to flat that longitude/latitude can be treated as x/y, as long as
     * longitude is scaled by cos(latitude) so one unit means the same distance
     * in both directions.
     */
    public static NearestOnLine nearestOnLine(LngLat target, List<LngLat> line, double[] cumulative) {
        NearestOnLine best = null;
        double scaleX = Math.cos(Math.toRadians(target.lat()));

        for (int i = 0; i < line.size() - 1; i++) {
            LngLat a = line.get(i);
            LngLat b = line.get(i + 1);
            double dx = (b.lng() - a.lng()) * scaleX;
            double dy = b.lat() - a.lat();
            double lengthSquared = dx * dx + dy * dy;
            // How far along the segment the closest point is: 0 = at a, 1 = at b.
            double t = lengthSquared == 0 ? 0 : Math.clamp(
                    ((target.lng() - a.lng()) * scaleX * dx + (target.lat() - a.lat()) * dy) / lengthSquared,
                    0.0, 1.0);
            LngLat point = new LngLat(a.lng() + (b.lng() - a.lng()) * t, a.lat() + (b.lat() - a.lat()) * t);
            double distanceM = haversineMetres(target, point);
            if (best == null || distanceM < best.distanceM()) {
                double segmentM = cumulative[i + 1] - cumulative[i];
                best = new NearestOnLine(point, distanceM, cumulative[i] + segmentM * t);
            }
        }
        return best;
    }

    /** Index of the last point at or before {@code metres} along the line. */
    public static int indexAtDistance(double[] cumulative, double metres) {
        int low = 0;
        int high = cumulative.length - 1;
        while (low < high) {
            int middle = (low + high + 1) / 2;
            if (cumulative[middle] <= metres) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }
        return low;
    }

    /** The part of a line between two distances from its start, in metres. */
    public static List<LngLat> sliceLine(List<LngLat> line, double[] cumulative, double fromM, double toM) {
        List<LngLat> result = new ArrayList<>();
        result.add(pointAt(line, cumulative, fromM));
        for (int i = 0; i < line.size(); i++) {
            if (cumulative[i] > fromM && cumulative[i] < toM) {
                result.add(line.get(i));
            }
        }
        result.add(pointAt(line, cumulative, toM));
        return result;
    }

    private static LngLat pointAt(List<LngLat> line, double[] cumulative, double metres) {
        int index = indexAtDistance(cumulative, metres);
        LngLat a = line.get(index);
        if (index + 1 >= line.size()) {
            return a;
        }
        LngLat b = line.get(index + 1);
        double span = cumulative[index + 1] - cumulative[index];
        double t = span == 0 ? 0 : (metres - cumulative[index]) / span;
        return new LngLat(a.lng() + (b.lng() - a.lng()) * t, a.lat() + (b.lat() - a.lat()) * t);
    }
}
