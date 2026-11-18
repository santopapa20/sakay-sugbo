import { Modal } from '../../components/Modal';
import { useAppStore } from '../../store/appStore';

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'unknown date';

/** Says exactly where the data comes from, how fresh it is, and what is missing. */
export default function AboutDataModal() {
  const open = useAppStore((state) => state.aboutOpen);
  const setAboutOpen = useAppStore((state) => state.setAboutOpen);
  const meta = useAppStore((state) => state.meta);

  return (
    <Modal open={open} onClose={() => setAboutOpen(false)} title="About the data">
      {meta && (
        <div className="flex flex-col gap-4 text-[15px] text-fog-300">
          <p>
            Every route, stop and place in this app comes from{' '}
            <a
              href={meta.licenceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-mint-400 underline underline-offset-4"
            >
              OpenStreetMap
            </a>
            , a map built by volunteers. Nothing was typed in by hand or guessed: route codes, lines and
            stop names are shown as the volunteers recorded them.
          </p>

          <dl className="grid grid-cols-2 gap-3 rounded-md border border-night-600 p-3 text-sm">
            <div>
              <dt className="eyebrow">Map data as of</dt>
              <dd className="text-fog-100">{formatDate(meta.osmDataTimestamp)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Checked on the ground</dt>
              <dd className="text-amber-400">{meta.fieldVerified ? 'Yes' : 'Not yet'}</dd>
            </div>
            <div>
              <dt className="eyebrow">Routes</dt>
              <dd className="text-fog-100">
                {meta.counts.routeCodes} codes, {meta.counts.routeDirections} directions
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Places and streets</dt>
              <dd className="text-fog-100">
                {meta.counts.places.toLocaleString()} places, {meta.counts.streets.toLocaleString()} streets
              </dd>
            </div>
          </dl>

          <section>
            <h3 className="eyebrow mb-1">What this means for you</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>A route can be out of date or wrong. Confirm with the signboard or the driver.</li>
              <li>Fares, schedules and travel times are not shown, because no verified source was found.</li>
              <li>Some real routes are missing. A route is only included when its line joins up cleanly and its stops are mapped.</li>
            </ul>
          </section>

          {meta.skippedRoutes.length > 0 && (
            <section>
              <h3 className="eyebrow mb-1">Left out for now</h3>
              <ul className="space-y-1 text-sm">
                {meta.skippedRoutes.map((skipped) => (
                  <li key={skipped.relation}>
                    <span className="font-semibold text-fog-100">{skipped.code}</span>: {skipped.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="border-t border-night-600 pt-3 text-sm text-fog-400">
            Data © OpenStreetMap contributors, {meta.licence}. Base map tiles by OpenFreeMap. Found a
            mistake? Each route page links to its OpenStreetMap entry, where anyone can correct it.
          </p>
        </div>
      )}
    </Modal>
  );
}
