import { MapPin, Star, Trash2 } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { useAppStore } from '../../store/appStore';
import { RouteCard } from '../routes/RoutesPanel';
import { categoryLabel } from '../search/searchIndex';

/** The Saved tab: routes and places the user starred, kept in this browser. */
export function SavedPanel() {
  const favourites = useAppStore((state) => state.favourites);
  const groups = useAppStore((state) => state.groups);
  const focusPlace = useAppStore((state) => state.focusPlace);
  const toggleFavouritePlace = useAppStore((state) => state.toggleFavouritePlace);

  const savedGroups = groups.filter((group) => favourites.routeCodes.includes(group.code));
  const nothingSaved = savedGroups.length === 0 && favourites.places.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Saved</p>
        <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-wide">
          Your routes and places
        </h2>
      </div>

      {nothingSaved && (
        <EmptyState icon={<Star className="size-5" />} title="Nothing saved yet">
          Press the star on a route or a place to keep it here. Saved items stay in this browser only;
          no account is needed.
        </EmptyState>
      )}

      {savedGroups.length > 0 && (
        <section aria-labelledby="saved-routes">
          <h3 id="saved-routes" className="eyebrow mb-2">
            Routes
          </h3>
          <ul className="flex flex-col gap-2">
            {savedGroups.map((group) => (
              <RouteCard key={group.code} group={group} />
            ))}
          </ul>
        </section>
      )}

      {favourites.places.length > 0 && (
        <section aria-labelledby="saved-places">
          <h3 id="saved-places" className="eyebrow mb-2">
            Places
          </h3>
          <ul className="flex flex-col gap-2">
            {favourites.places.map((place) => (
              <li key={place.id} className="flex items-center rounded-md border border-night-600 hover:border-night-500">
                <button
                  type="button"
                  onClick={() => focusPlace(place)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-l-md py-2.5 pl-3 text-left"
                >
                  <MapPin className="size-5 shrink-0 text-cyan-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-fog-100">{place.name}</span>
                    <span className="block truncate text-[13px] text-fog-400">{categoryLabel(place.category)}</span>
                  </span>
                </button>
                <IconButton label={`Remove ${place.name} from saved`} onClick={() => toggleFavouritePlace(place)}>
                  <Trash2 className="size-4.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
