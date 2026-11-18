/**
 * Labels that float above a spot on the map, joined to it by a thin stem:
 * the start and end of a route, a selected stop, a tapped place.
 *
 * They are ordinary HTML elements that MapLibre keeps pinned to a
 * coordinate. Text is set with `textContent`, never as HTML, so a place name
 * from the data can never inject markup into the page.
 */
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';

export interface LabelSpec {
  /** Stable name for this label, so it is updated rather than rebuilt. */
  key: string;
  lng: number;
  lat: number;
  /** Small capital line, e.g. "START". */
  overline?: string;
  title: string;
  /** Colour of the overline, stem end and dot. Defaults to mint. */
  accent?: string;
}

function buildElement(spec: LabelSpec): HTMLElement {
  const root = document.createElement('div');
  root.className = 'map-label';
  if (spec.accent) root.style.setProperty('--label-accent', spec.accent);

  const card = document.createElement('div');
  card.className = 'map-label__card';
  if (spec.overline) {
    const overline = document.createElement('span');
    overline.className = 'map-label__overline';
    overline.textContent = spec.overline;
    card.append(overline);
  }
  const title = document.createElement('span');
  title.className = 'map-label__title';
  title.textContent = spec.title;
  card.append(title);

  const stem = document.createElement('div');
  stem.className = 'map-label__stem';
  const dot = document.createElement('div');
  dot.className = 'map-label__dot';

  root.append(card, stem, dot);
  // The panels describe the same things in text, so screen readers skip these.
  root.setAttribute('aria-hidden', 'true');
  return root;
}

export class FloatingLabels {
  private readonly markers = new Map<string, { marker: Marker; signature: string }>();

  constructor(private readonly map: MapLibreMap) {}

  /** Makes the labels on the map match `specs`: adds new ones, moves or removes old ones. */
  sync(specs: LabelSpec[]) {
    const wanted = new Set(specs.map((spec) => spec.key));
    for (const [key, entry] of this.markers) {
      if (!wanted.has(key)) {
        entry.marker.remove();
        this.markers.delete(key);
      }
    }
    for (const spec of specs) {
      const signature = `${spec.overline}|${spec.title}|${spec.accent}`;
      const existing = this.markers.get(spec.key);
      if (existing && existing.signature === signature) {
        existing.marker.setLngLat([spec.lng, spec.lat]);
        continue;
      }
      existing?.marker.remove();
      const marker = new Marker({ element: buildElement(spec), anchor: 'bottom' })
        .setLngLat([spec.lng, spec.lat])
        .addTo(this.map);
      this.markers.set(spec.key, { marker, signature });
    }
  }

  destroy() {
    for (const { marker } of this.markers.values()) marker.remove();
    this.markers.clear();
  }
}
