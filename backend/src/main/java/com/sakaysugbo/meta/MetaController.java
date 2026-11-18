package com.sakaysugbo.meta;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Facts about the data set: where it came from, how fresh it is, what was left out. */
@RestController
public class MetaController {

    private final JsonMapper json;

    public MetaController(JsonMapper json) {
        this.json = json;
    }

    /** {@code GET /api/meta}: the contents of data/meta.json, unchanged. */
    @GetMapping("/api/meta")
    public JsonNode meta() throws IOException {
        try (InputStream in = new ClassPathResource("data/meta.json").getInputStream()) {
            return json.readTree(in);
        }
    }
}
