package com.sakaysugbo.route;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;

/**
 * One direction of travel of a jeepney route, as stored in the database.
 *
 * <p>Tables this class creates:
 * <ul>
 *   <li>{@code route}: one row per direction (code, name, colour ...)</li>
 *   <li>{@code route_point}: the line it drives, one row per point, in order</li>
 *   <li>{@code route_stop}: its mapped stops, in order</li>
 *   <li>{@code route_street}: which street it is on from which point</li>
 * </ul>
 *
 * <p>The three lists are "element collections": rows that belong to exactly
 * one route and have no life of their own. {@code @OrderColumn} adds a
 * {@code sequence} column so the order survives a round trip to the database.
 */
@Entity
@Table(name = "route")
public class Route {

    /** The OpenStreetMap relation, e.g. "osm-21251275". */
    @Id
    @Column(length = 40)
    private String id;

    /** The code painted on the jeepney, e.g. "13C". */
    @Column(nullable = false, length = 12)
    private String code;

    @Column(length = 160)
    private String name;

    // "from" and "to" are reserved words in SQL, so the columns get longer names.
    @Column(name = "terminal_from", length = 160)
    private String from;

    @Column(name = "terminal_to", length = 160)
    private String to;

    @Column(length = 160)
    private String firstStopName;

    @Column(length = 160)
    private String lastStopName;

    @Column(length = 300)
    private String operator;

    @Column(length = 160)
    private String network;

    @Column(nullable = false, length = 9)
    private String colour;

    // Named explicitly: left alone, the column would be called "lengthm".
    @Column(name = "length_m")
    private int lengthM;

    private long osmRelationId;

    /** True only once someone has checked the route on the ground. */
    private boolean fieldVerified;

    @ElementCollection
    @CollectionTable(name = "route_point", joinColumns = @JoinColumn(name = "route_id"))
    @OrderColumn(name = "sequence")
    private List<Point> points = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "route_stop", joinColumns = @JoinColumn(name = "route_id"))
    @OrderColumn(name = "sequence")
    private List<Stop> stops = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "route_street", joinColumns = @JoinColumn(name = "route_id"))
    @OrderColumn(name = "sequence")
    private List<Street> streets = new ArrayList<>();

    /** One point of the route's line. */
    @Embeddable
    public record Point(double latitude, double longitude) {
    }

    /** A mapped stop and how many metres along the route it is. */
    @Embeddable
    public record Stop(
            @Column(length = 40) String osmId,
            @Column(length = 160) String name,
            double latitude,
            double longitude,
            @Column(name = "along_m") int alongM) {
    }

    /** "From point number {@code fromIndex} onwards the route runs on this street." */
    @Embeddable
    public record Street(@Column(length = 160) String name, int fromIndex) {
    }

    /** Needed by JPA, which creates the object first and fills it in afterwards. */
    protected Route() {
    }

    public Route(String id, String code, String name, String from, String to, String firstStopName,
            String lastStopName, String operator, String network, String colour, int lengthM,
            long osmRelationId, boolean fieldVerified, List<Point> points, List<Stop> stops,
            List<Street> streets) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.from = from;
        this.to = to;
        this.firstStopName = firstStopName;
        this.lastStopName = lastStopName;
        this.operator = operator;
        this.network = network;
        this.colour = colour;
        this.lengthM = lengthM;
        this.osmRelationId = osmRelationId;
        this.fieldVerified = fieldVerified;
        this.points = new ArrayList<>(points);
        this.stops = new ArrayList<>(stops);
        this.streets = new ArrayList<>(streets);
    }

    public String getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getFrom() {
        return from;
    }

    public String getTo() {
        return to;
    }

    public String getFirstStopName() {
        return firstStopName;
    }

    public String getLastStopName() {
        return lastStopName;
    }

    public String getOperator() {
        return operator;
    }

    public String getNetwork() {
        return network;
    }

    public String getColour() {
        return colour;
    }

    public int getLengthM() {
        return lengthM;
    }

    public long getOsmRelationId() {
        return osmRelationId;
    }

    public boolean isFieldVerified() {
        return fieldVerified;
    }

    public List<Point> getPoints() {
        return points;
    }

    public List<Stop> getStops() {
        return stops;
    }

    public List<Street> getStreets() {
        return streets;
    }
}
