/// <reference types="vite/client" />

/** Settings read from .env files. Only names starting with VITE_ reach the browser. */
interface ImportMetaEnv {
  /** "static" (default) reads GeoJSON files; "api" calls the Spring Boot backend. */
  readonly VITE_DATA_SOURCE?: 'static' | 'api';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
