interface RouteBadgeProps {
  code: string;
  colour: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: 'h-6 min-w-10 px-1.5 text-[15px]',
  md: 'h-8 min-w-13 px-2 text-xl',
  lg: 'h-12 min-w-20 px-3 text-4xl',
};

/**
 * A route code shown the way it appears on the jeepney itself: bold
 * condensed capitals on a coloured plate, like the painted signboard in the
 * windscreen. The colour is the route's colour on the map.
 */
export function RouteBadge({ code, colour, size = 'md' }: RouteBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xs font-display font-bold leading-none tracking-wide text-night-950 ${SIZE[size]}`}
      style={{ backgroundColor: colour }}
    >
      <span className="sr-only">Route </span>
      {code}
    </span>
  );
}
