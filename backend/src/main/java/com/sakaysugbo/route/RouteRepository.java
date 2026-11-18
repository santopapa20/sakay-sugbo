package com.sakaysugbo.route;

import org.springframework.data.jpa.repository.JpaRepository;

/** Database access for routes. Spring writes the implementation for us. */
public interface RouteRepository extends JpaRepository<Route, String> {
}
