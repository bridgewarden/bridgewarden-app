import { FileTextIcon, KeyRoundIcon } from 'lucide-react';

import { t, type MessageKey } from '~/lib/i18n/en';

import type { SearchField, SearchResult } from '../vault-list.search.lib';

const FIELD_LABEL: Record<SearchField, MessageKey> = {
  name: 'search.field.name',
  username: 'search.field.username',
  url: 'search.field.url',
  notes: 'search.field.notes',
  body: 'search.field.body',
};

const Highlighted = ({ before, match, after }: Pick<SearchResult, 'before' | 'match' | 'after'>) => (
  <>
    {before}
    {match ? <mark className="rounded-sm bg-primary/20 px-0.5 text-foreground">{match}</mark> : null}
    {after}
  </>
);

type VaultSearchResultProps = {
  result: SearchResult;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
};

export const VaultSearchResult = ({ result, active, onHover, onSelect }: VaultSearchResultProps) => {
  const secondary =
    result.field === 'name' ? (
      (result.item.username ?? t(result.item.type === 'login' ? 'vault.type.login' : 'vault.type.note'))
    ) : (
      <>
        <span className="text-muted-foreground">{t(FIELD_LABEL[result.field])}: </span>
        <Highlighted before={result.before} match={result.match} after={result.after} />
      </>
    );

  return (
    <button
      type="button"
      role="option"
      id={`vault-search-result-${result.item.id}`}
      aria-selected={active}
      tabIndex={-1}
      data-active={active}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none hover:bg-muted/60 data-[active=true]:bg-muted"
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
        {result.item.type === 'login' ? (
          <KeyRoundIcon className="size-4" aria-hidden="true" />
        ) : (
          <FileTextIcon className="size-4" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {result.field === 'name' ? (
            <Highlighted before={result.before} match={result.match} after={result.after} />
          ) : (
            result.item.name
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm">{secondary}</span>
      </span>
    </button>
  );
};
