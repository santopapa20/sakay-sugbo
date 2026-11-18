import { ErrorState } from './components/ErrorState';
import { SkeletonList } from './components/Skeleton';
import { ExplorePanel } from './features/explore/ExplorePanel';
import { SavedPanel } from './features/favorites/SavedPanel';
import { RouteDetail } from './features/routes/RouteDetail';
import { RoutesPanel } from './features/routes/RoutesPanel';
import { TripPanel } from './features/trip/TripPanel';
import { useAppStore, useSelectedRoute } from './store/appStore';

/**
 * Decides what the panel shows. The same content is used in the desktop side
 * panel and in the phone bottom sheet, so the two layouts can never drift apart.
 */
export function PanelContent() {
  const dataStatus = useAppStore((state) => state.dataStatus);
  const dataError = useAppStore((state) => state.dataError);
  const loadData = useAppStore((state) => state.loadData);
  const tab = useAppStore((state) => state.tab);
  const selectedRoute = useSelectedRoute();

  if (dataStatus === 'loading') return <SkeletonList />;
  if (dataStatus === 'error') {
    return (
      <ErrorState
        title="The route data could not be loaded"
        message="Check your connection and try again. The map itself may still be visible."
        detail={dataError}
        onRetry={() => void loadData()}
      />
    );
  }

  // An open route takes over the panel, whichever tab it was opened from.
  if (selectedRoute) return <RouteDetail route={selectedRoute} />;

  switch (tab) {
    case 'explore':
      return <ExplorePanel />;
    case 'trip':
      return <TripPanel />;
    case 'routes':
      return <RoutesPanel />;
    case 'saved':
      return <SavedPanel />;
  }
}
