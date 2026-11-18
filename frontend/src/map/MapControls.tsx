import { Box, Home, LoaderCircle, LocateFixed, Minus, Navigation2, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { IconButton } from '../components/IconButton';
import { useAppStore } from '../store/appStore';
import { flyToPoint, goHome, resetNorth, rotateBy, setTilted, zoomBy } from './camera';

/** How far one press of a rotate button turns the map: an eighth of a full turn. */
const ROTATE_STEP_DEGREES = 45;

/** The buttons at the edge of the map: locate, zoom, 3D, home, and rotation. */
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

  const facingNorth = Math.abs(bearing) < 0.5;

  return (
    <div className="absolute right-3 top-[132px] z-10 flex flex-col items-end gap-2 lg:bottom-10 lg:right-4 lg:top-auto">
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

      {/* Rotation: turn left, compass (press to face north again), turn right.
          Laid out sideways so it adds no height on a phone. */}
      <div role="group" aria-label="Rotate the map" className="panel flex overflow-hidden">
        <IconButton
          label="Rotate the map left"
          onClick={() => rotateBy(map, ROTATE_STEP_DEGREES)}
          className="rounded-none"
        >
          <RotateCcw className="size-5" />
        </IconButton>
        <div className="w-px bg-night-600" />
        <IconButton
          label={facingNorth ? 'The map is facing north' : 'Point the map north'}
          active={!facingNorth}
          onClick={() => resetNorth(map)}
          className="rounded-none"
        >
          {/* The needle always points to north, like a real compass. */}
          <Navigation2 className="size-5" style={{ transform: `rotate(${-bearing}deg)` }} />
        </IconButton>
        <div className="w-px bg-night-600" />
        <IconButton
          label="Rotate the map right"
          onClick={() => rotateBy(map, -ROTATE_STEP_DEGREES)}
          className="rounded-none"
        >
          <RotateCw className="size-5" />
        </IconButton>
      </div>
    </div>
  );
}
