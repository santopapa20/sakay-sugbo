import { Info } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { Brand, BrandMark } from './components/Brand';
import { IconButton } from './components/IconButton';
import { BottomNav, TabBar } from './components/Navigation';
import { Toasts } from './components/Toasts';
import { CategoryFilter } from './features/places/CategoryFilter';
import { GlobalSearch } from './features/search/GlobalSearch';
import { useUrlSync } from './features/share/useUrlSync';
import { useMediaQuery } from './hooks/useMediaQuery';
import { DESKTOP_QUERY } from './map/camera';
import { PanelContent } from './PanelContent';
import { useAppStore, useViewKey } from './store/appStore';

// The map library is large, so it is fetched separately: the search box and
// panel appear first and the map fills in behind them.
const MapView = lazy(() => import('./map/MapView'));
const AboutDataModal = lazy(() => import('./features/about/AboutDataModal'));

export default function App() {
  const loadData = useAppStore((state) => state.loadData);
  const aboutOpen = useAppStore((state) => state.aboutOpen);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Opens whatever a shared link points at, and keeps the address up to date.
  useUrlSync();

  return (
    // reducedMotion="user" switches off movement for people who have asked their device for less of it.
    <MotionConfig reducedMotion="user">
      <div className="relative h-dvh w-full overflow-hidden bg-night-900">
        <Suspense fallback={null}>
          <MapView />
        </Suspense>

        {isDesktop ? <DesktopLayout /> : <PhoneLayout />}

        <Toasts />
        {aboutOpen && (
          <Suspense fallback={null}>
            <AboutDataModal />
          </Suspense>
        )}
      </div>
    </MotionConfig>
  );
}

/** Wide screens: a panel floating at the left, category chips along the top of the map. */
function DesktopLayout() {
  const scrollRef = useRef<HTMLElement>(null);
  const viewKey = useViewKey();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);

  return (
    <>
      <aside
        aria-label="Route finder"
        className="panel absolute bottom-4 left-4 top-4 z-20 flex w-[400px] flex-col"
      >
        <div className="flex flex-col gap-3 px-4 pt-4">
          <Brand />
          <GlobalSearch className="rounded-sm border border-night-600 bg-night-900" />
        </div>
        <div className="mt-2 px-1">
          <TabBar />
        </div>
        <main ref={scrollRef} className="scroll-area min-h-0 flex-1 px-4 py-4">
          <PanelContent />
        </main>
      </aside>
      <CategoryFilter className="absolute left-[432px] right-20 top-4 z-10" />
    </>
  );
}

/** Phones: search across the top, details in a sheet at the bottom, the map in between. */
function PhoneLayout() {
  const sheet = useAppStore((state) => state.sheet);
  const setSheet = useAppStore((state) => state.setSheet);
  const setAboutOpen = useAppStore((state) => state.setAboutOpen);
  const viewKey = useViewKey();

  return (
    <>
      <header className="absolute inset-x-0 top-0 z-30 flex flex-col gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="panel flex items-center pl-2.5">
          <BrandMark className="size-6 shrink-0" />
          <h1 className="sr-only">Sakay Sugbo, Cebu jeepney route finder</h1>
          <GlobalSearch className="min-w-0 flex-1" />
          <IconButton label="About the data" onClick={() => setAboutOpen(true)}>
            <Info className="size-5" />
          </IconButton>
        </div>
        <CategoryFilter className="-mx-3 px-3 pb-1" />
      </header>

      <BottomSheet snap={sheet} onSnapChange={setSheet} viewKey={viewKey}>
        <main>
          <PanelContent />
        </main>
      </BottomSheet>
      <BottomNav />
    </>
  );
}
