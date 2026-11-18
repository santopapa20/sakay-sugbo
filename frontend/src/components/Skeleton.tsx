/** Grey placeholder rows shown while the route data is loading. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading routes" className="flex flex-col gap-3">
      <div className="skeleton h-7 w-2/3" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-8 w-13" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
