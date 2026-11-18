package com.sakaysugbo.place;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private final PlaceRepository repository;

    public PlaceController(PlaceRepository repository) {
        this.repository = repository;
    }

    /**
     * {@code GET /api/places}: every place, by name.
     * {@code GET /api/places?category=hospital}: one category only.
     */
    @GetMapping
    public List<Place> places(@RequestParam(required = false) String category) {
        return category == null
                ? repository.findAllByOrderByNameAsc()
                : repository.findByCategoryOrderByNameAsc(category);
    }
}
