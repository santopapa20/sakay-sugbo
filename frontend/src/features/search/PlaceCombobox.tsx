import { BusFront, MapPin, Search, SignpostBig, X, type LucideIcon } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { RouteBadge } from '../../components/RouteBadge';
import { useAppStore } from '../../store/appStore';
import { search, type SearchResult } from './searchIndex';

interface PlaceComboboxProps {
  /** Read by screen readers; the visible hint is `placeholder`. */
  label: string;
  placeholder: string;
  /** Text shown when something is already chosen and the field is not being edited. */
  value?: string;
  /** Which kinds of result this field accepts. A trip end cannot be a route code. */
  kinds?: SearchResult['kind'][];
  onSelect: (result: SearchResult) => void;
  onClear?: () => void;
  icon?: ReactNode;
  /** Extra buttons inside the field, on the right. */
  trailing?: ReactNode;
  className?: string;
}

const KIND_ICON: Record<'place' | 'stop', LucideIcon> = { place: MapPin, stop: BusFront };

/**
 * A text field with suggestions underneath (a "combobox").
 *
 * Suggestions come from the app's own data, so every one of them is a real
 * place with a position on the map. Works with the keyboard: arrow keys move
 * through the list, Enter chooses, Escape closes.
 */
export function PlaceCombobox({
  label,
  placeholder,
  value,
  kinds = ['place', 'stop', 'route'],
  onSelect,
  onClear,
  icon,
  trailing,
  className = '',
}: PlaceComboboxProps) {
  const index = useAppStore((state) => state.searchIndex);
  const groups = useAppStore((state) => state.groups);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    if (!index || !query.trim()) return [];
    return search(index, query, 12)
      .filter((result) => kinds.includes(result.kind))
      .slice(0, 7);
    // `kinds` is a fresh array on every render; its contents do not change.
  }, [index, query]);

  const showList = open && query.trim().length > 0;
  const editing = open || query.length > 0;

  const choose = (result: SearchResult) => {
    onSelect(result);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      const result = results[active];
      if (showList && result) {
        event.preventDefault();
        choose(result);
      }
    } else if (event.key === 'Escape') {
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex h-12 items-center gap-2 pl-3 pr-1">
        <span className="shrink-0 text-fog-400" aria-hidden="true">
          {icon ?? <Search className="size-5" />}
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={editing ? query : (value ?? '')}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Wait a moment before closing, so a click on a suggestion still registers.
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-fog-100 placeholder:text-fog-500 focus:outline-none"
        />
        {(query || (value && onClear)) && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              setQuery('');
              onClear?.();
              inputRef.current?.focus();
            }}
            className="grid size-9 shrink-0 place-items-center rounded-sm text-fog-400 hover:bg-night-700 hover:text-fog-100"
          >
            <X className="size-4" />
          </button>
        )}
        {trailing}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="panel absolute inset-x-0 top-full z-40 mt-1.5 max-h-[52dvh] overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-fog-400">
              Nothing in the Cebu data matches “{query.trim()}”. Try a landmark, a street or a route
              code, or tap the place on the map.
            </li>
          )}
          {results.map((result, i) => {
            const Icon = result.kind === 'route' ? SignpostBig : KIND_ICON[result.kind];
            const colour =
              result.kind === 'route' ? groups.find((g) => g.code === result.code)?.colour : undefined;
            return (
              <li
                key={result.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // onMouseDown fires before the input loses focus; onClick would be too late.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(result);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                  i === active ? 'bg-night-700' : ''
                }`}
              >
                {result.kind === 'route' && colour ? (
                  <RouteBadge code={result.code} colour={colour} size="sm" />
                ) : (
                  <Icon className="size-4.5 shrink-0 text-fog-400" aria-hidden="true" />
                )}
                <span className="min-w-0">
                  {result.kind !== 'route' && (
                    <span className="block truncate text-[15px] font-medium text-fog-100">{result.title}</span>
                  )}
                  <span className="block truncate text-[13px] text-fog-400">{result.subtitle}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
