package com.sakaysugbo.place;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Database access for places. Spring writes the queries from the method names. */
public interface PlaceRepository extends JpaRepository<Place, String> {

    List<Place> findAllByOrderByNameAsc();

    List<Place> findByCategoryOrderByNameAsc(String category);
}
