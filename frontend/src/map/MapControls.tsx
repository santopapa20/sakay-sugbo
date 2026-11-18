import { Box, Home, LoaderCircle, LocateFixed, Minus, Navigation2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { IconButton } from '../components/IconButton';
import { useAppStore } from '../store/appStore';
import { flyToPoint, goHome, resetNorth, setTilted, zoomBy } from './camera';

/** The column of round-the-map buttons: locate, zoom, compass, 3D, home. */
export function MapControls({ map }: { map: MapLibreMap }) {
  const locating = useAppStore((state) => state.locating);
  const locateUser = useAppStore((state) => state.locateUser);
  const userLocation = useAppStore((state) => state.userLocation);
  const [bearing, setBearing] = useState(() => map.getBearing());
  const [tilted, setTiltedState] = useState(() => map.getPitch() > 10);

  // Keep the compass needle and the 3D button in step with the map.
  useEffect(() => {
    const onRotate = () => setBearing(map.getBearing());
    const onPitch = () => setTiltedState(map.getPitch() > 10);
    map.on('rotate', onRotate);
    map.on('pitch', onPitch);
    return () => {
      map.off('rotate', onRotate);
      map.off('pitch', onPitch);
    };
  }, [map]);

  const handleLocate = async () => {
    // The browser only asks for permission here, when the button is pressed.
    const here = await locateUser();
    if (here) flyToPoint(map, here);
  };

  return (
    <div className="absolute right-3 top-[132px] z-10 flex flex-col gap-2 lg:bottom-10 lg:right-4 lg:top-auto">
      <IconButton
        variant="solid"
        label={locating ? 'Finding your location' : 'Show my location'}
        active={Boolean(userLocation)}
        disabled={locating}
        onClick={handleLocate}
      >
        {locating ? <LoaderCircle className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
      </IconButton>

      {/* Pinching is the natural way to zoom on a phone, so these show on larger screens only. */}
      <div className="panel hidden flex-col overflow-hidden sm:flex">
        <IconButton label="Zoom in" onClick={() => zoomBy(map, 1)} className="rounded-none">
          <Plus className="size-5" />
        </IconButton>
        <div className="h-px bg-night-600" />
        <IconButton label="Zoom out" onClick={() => zoomBy(map, -1)} className="rounded-none">
          <Minus className="size-5" />
        </IconButton>
      </div>

      <IconButton variant="solid" label="Point the map north" onClick={() => resetNorth(map)}>
        <Navigation2
          className="size-5 transition-transform duration-150"
          style={{ transform: `rotate(${-bearing}deg)` }}
        />
      </IconButton>
      <IconButton
        variant="solid"
        label={tilted ? 'Switch to flat view' : 'Switch to 3D view'}
        aria-pressed={tilted}
        active={tilted}
        onClick={() => setTilted(map, !tilted)}
      >
        <Box className="size-5" />
      </IconButton>
      <IconButton variant="solid" label="Back to the starting view" onClick={() => goHome(map)}>
        <Home className="size-5" />
      </IconButton>
    </div>
  );
}
