import { animate, motion, useMotionValue, type PanInfo } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SheetSnap } from '../store/appStore';

interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Changes whenever the sheet shows something new, so it can scroll back to the top. */
  viewKey: string;
  children: ReactNode;
}

const ORDER: SheetSnap[] = ['peek', 'half', 'full'];
const NAME = { peek: 'small', half: 'half height', full: 'full height' };

/** Heights of the three resting positions for the current screen. */
function snapHeights(viewportHeight: number): Record<SheetSnap, number> {
  return {
    peek: 150,
    half: Math.round(viewportHeight * 0.46),
    full: viewportHeight - 56 - 76, // leaves the search bar visible above it
  };
}

/**
 * The phone layout's panel: it slides up from the bottom and rests at three
 * heights, so the map stays visible while you read.
 *
 * Drag the handle to resize, or press it (it is a real button, so it also
 * works from a keyboard) to step through the sizes.
 */
export function BottomSheet({ snap, onSnapChange, viewKey, children }: BottomSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);

  const heights = snapHeights(viewportHeight);
  const height = useMotionValue(heights[snap]);
  const dragStartHeight = useRef(0);
  const dragged = useRef(false);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Glide to the resting height whenever the snap point (or the screen) changes.
  useEffect(() => {
    const controls = animate(height, heights[snap], { type: 'spring', stiffness: 380, damping: 38 });
    return () => controls.stop();
    // `height` and `heights` are left out on purpose: they are derived from the two values listed.
  }, [snap, viewportHeight]);

  const onPanStart = () => {
    dragStartHeight.current = height.get();
    dragged.current = false;
  };

  const onPan = (_: PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.y) > 6) dragged.current = true;
    const next = dragStartHeight.current - info.offset.y;
    height.set(Math.max(heights.peek - 40, Math.min(heights.full + 20, next)));
  };

  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    // A quick flick moves one step; otherwise settle on the nearest height.
    const projected = height.get() - info.velocity.y * 0.18;
    const nearest = ORDER.reduce((best, candidate) =>
      Math.abs(heights[candidate] - projected) < Math.abs(heights[best] - projected) ? candidate : best,
    );
    if (nearest === snap) animate(height, heights[snap], { type: 'spring', stiffness: 380, damping: 38 });
    else onSnapChange(nearest);
  };

  const stepSize = () => {
    if (dragged.current) return; // that press was the end of a drag
    onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half');
  };

  return (
    <motion.section
      aria-label="Details"
      style={{ height }}
      className="panel fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-20 flex flex-col rounded-b-none rounded-t-lg border-x-0 border-b-0"
    >
      <motion.button
        type="button"
        aria-label={`Resize panel. Currently ${NAME[snap]}.`}
        onPanStart={onPanStart}
        onPan={onPan}
        onPanEnd={onPanEnd}
        onClick={stepSize}
        className="grid h-7 w-full shrink-0 touch-none place-items-center rounded-t-lg"
      >
        <span className="h-1 w-10 rounded-full bg-night-500" />
      </motion.button>
      <div ref={scrollRef} className="scroll-area min-h-0 flex-1 px-4 pb-5">
        {children}
      </div>
    </motion.section>
  );
}
