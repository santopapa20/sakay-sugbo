package com.sakaysugbo.place;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * A named place people search for: a mall, a hospital, a terminal, a street.
 * The fields are also the JSON the frontend receives (its {@code Place} type).
 */
@Entity
@Table(name = "place", indexes = @Index(name = "idx_place_category", columnList = "category"))
public class Place {

    @Id
    @Column(length = 80)
    private String id;

    @Column(nullable = false, length = 200)
    private String name;

    /** terminal, transport, education, hospital, shopping, government, landmark, area or street. */
    @Column(nullable = false, length = 20)
    private String category;

    @Column(length = 200)
    private String address;

    private double lng;

    private double lat;

    /** Needed by JPA. */
    protected Place() {
    }

    public Place(String id, String name, String category, String address, double lng, double lat) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.address = address;
        this.lng = lng;
        this.lat = lat;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getCategory() {
        return category;
    }

    public String getAddress() {
        return address;
    }

    public double getLng() {
        return lng;
    }

    public double getLat() {
        return lat;
    }
}
