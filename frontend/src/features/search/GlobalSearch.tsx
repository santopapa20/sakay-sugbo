import { useAppStore } from '../../store/appStore';
import type { Place } from '../../types';
import { PlaceCombobox } from './PlaceCombobox';
import type { SearchResult } from './searchIndex';

/** The main search box: find a place, a street, a stop or a route code and go to it. */
export function GlobalSearch({ className }: { className?: string }) {
  const focusPlace = useAppStore((state) => state.focusPlace);
  const selectRoute = useAppStore((state) => state.selectRoute);
  const groups = useAppStore((state) => state.groups);

  const onSelect = (result: SearchResult) => {
    if (result.kind === 'route') {
      const first = groups.find((group) => group.code === result.code)?.directions[0];
      if (first) selectRoute(first.id);
      return;
    }
    // A stop is treated as a place so that it gets the same "what passes here?" view.
    const place: Place =
      result.kind === 'place'
        ? result.place
        : { id: result.id, name: result.title, category: 'transport', address: null, ...result.position };
    focusPlace(place);
  };

  return (
    <PlaceCombobox
      label="Search Cebu"
      placeholder="Search a place, street or route code"
      onSelect={onSelect}
      className={className}
    />
  );
}
