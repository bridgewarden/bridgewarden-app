import { useEffect, useMemo, useRef, useState } from 'react';

import { SearchIcon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import type { DecryptedItem } from '~/lib/vault/projection';

import { buildSearchIndex, SEARCH_DEBOUNCE_MS, searchItems, type SearchResult } from '../vault-list.search.lib';
import { VaultSearchResult } from './vault-search-result';

type VaultSearchDialogProps = {
  items: DecryptedItem[];
  disabled?: boolean;
  onOpenItem: (id: string) => void;
};

const INPUT_ID = 'vault-search-input';
const RESULTS_ID = 'vault-search-results';

export const VaultSearchDialog = ({ items, disabled = false, onOpenItem }: VaultSearchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const index = useMemo(() => (open ? buildSearchIndex(items) : []), [items, open]);
  const { results, total } = useMemo(() => searchItems(index, debouncedQuery), [debouncedQuery, index]);
  const pending = query.trim().toLocaleLowerCase() !== debouncedQuery.trim().toLocaleLowerCase();
  const displayResults = pending ? [] : results;
  const displayTotal = pending ? 0 : total;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (disabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled]);

  const reset = () => {
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(0);
  };

  const select = (result: SearchResult) => {
    reset();
    setOpen(false);
    onOpenItem(result.item.id);
  };

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, displayResults.length - 1));
  const activeResult = displayResults[safeActiveIndex];

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      reset();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(Math.min(safeActiveIndex + 1, Math.max(0, displayResults.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(Math.max(safeActiveIndex - 1, 0));
      return;
    }
    if (event.key === 'Enter' && displayResults[safeActiveIndex]) {
      event.preventDefault();
      select(displayResults[safeActiveIndex]);
    }
  };

  const countMessage = pending
    ? t('search.searching')
    : debouncedQuery.trim()
      ? displayTotal === 0
        ? t('search.empty')
        : `${t('search.count', { count: displayTotal })}${
            displayTotal > displayResults.length
              ? ` ${t('search.capped', { shown: displayResults.length, total: displayTotal })}`
              : ''
          }`
      : t('search.hint');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button ref={triggerRef} type="button" variant="outline" className="min-h-11 gap-2" disabled={disabled}>
          <SearchIcon aria-hidden="true" />
          <span>{t('search.trigger')}</span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            {t('search.shortcut')}
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!triggerRef.current?.disabled) triggerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('search.title')}</DialogTitle>
          <DialogDescription>{t('search.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={INPUT_ID} className="sr-only">
            {t('search.label')}
          </Label>
          <Input
            id={INPUT_ID}
            type="search"
            role="combobox"
            autoFocus
            aria-expanded={!pending && displayResults.length > 0}
            aria-controls={RESULTS_ID}
            aria-autocomplete="list"
            aria-activedescendant={activeResult ? `vault-search-result-${activeResult.item.id}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
          />
        </div>

        <div
          id={RESULTS_ID}
          role="listbox"
          aria-label={t('search.results')}
          className="max-h-80 space-y-1 overflow-y-auto"
        >
          {displayResults.map((result, index) => (
            <VaultSearchResult
              key={result.item.id}
              result={result}
              active={index === safeActiveIndex}
              onHover={() => setActiveIndex(index)}
              onSelect={() => select(result)}
            />
          ))}
        </div>

        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {countMessage}
        </p>
      </DialogContent>
    </Dialog>
  );
};
