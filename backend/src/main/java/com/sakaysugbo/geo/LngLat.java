package com.sakaysugbo.geo;

/** A position on the map. Longitude first, to match GeoJSON and the frontend. */
public record LngLat(double lng, double lat) {
}
