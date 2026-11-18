import { Link2 } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { useAppStore } from '../../store/appStore';

/**
 * Copies a link to what is on screen. The address already describes it
 * (see useUrlSync), so this only has to copy the address.
 */
export function ShareButton({ what, className }: { what: string; className?: string }) {
  const showToast = useAppStore((state) => state.showToast);

  const copyLink = async () => {
    const { tab, tripOrigin, tripDestination, selectedRouteId } = useAppStore.getState();
    const sharesLocation =
      !selectedRouteId && tab === 'trip' && (tripOrigin?.kind === 'me' || tripDestination?.kind === 'me');
    try {
      // Not every browser allows this (it needs https or localhost, and a focused page).
      await navigator.clipboard.writeText(window.location.href);
      showToast(
        sharesLocation
          ? 'Link copied. It includes the spot where you were when you used "my location".'
          : 'Link copied. Anyone who opens it sees the same thing.',
        'success',
      );
    } catch {
      showToast('Could not copy automatically. Copy the address from the top of your browser instead.', 'warning');
    }
  };

  return (
    <IconButton label={`Copy a link to ${what}`} onClick={copyLink} className={className}>
      <Link2 className="size-5" />
    </IconButton>
  );
}
