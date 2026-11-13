# vault-search Specification

## Purpose
Defines client-side search over decrypted vault items without a server round trip.

## Requirements

### Requirement: Decrypted field matching

Search SHALL match case-insensitive substrings in decrypted item name, username, every URL, notes, and secure-note body. Trashed and unavailable rows MUST NOT appear in results.

#### Scenario: Match each supported field
- **WHEN** a query matches an item's name, username, URL, notes, or body
- **THEN** that item appears once in the result set

#### Scenario: Trashed item
- **WHEN** an item is soft-deleted
- **THEN** it is excluded from search results

#### Scenario: Empty query
- **WHEN** the query is empty or whitespace
- **THEN** no result rows are shown

### Requirement: Search palette and keyboard behavior

`Ctrl/Cmd+K` SHALL open a search palette from the vault list. A visible trigger SHALL provide the same action. The palette SHALL focus its input, support ArrowUp/ArrowDown and Enter, close on Escape, and restore focus to the trigger.

#### Scenario: Shortcut opens palette
- **WHEN** the vault list is visible and the user presses Ctrl/Cmd+K
- **THEN** the palette opens with the search input focused

#### Scenario: Keyboard result selection
- **WHEN** results are visible and the user presses ArrowDown then Enter
- **THEN** the active result opens the item detail dialog

#### Scenario: Close and restore
- **WHEN** the palette closes
- **THEN** focus returns to the search trigger

### Requirement: Highlighted snippets and result count

Results SHALL display the matched field with the matched substring highlighted using semantic markup. A polite live region SHALL announce the total number of matches.

#### Scenario: Highlight
- **WHEN** a query matches part of a field
- **THEN** the matched substring is rendered distinctly without HTML injection

#### Scenario: Count announcement
- **WHEN** the result set changes
- **THEN** assistive technology receives the total match count through a live region

### Requirement: Client-only privacy and offline behavior

Search MUST run only over decrypted in-memory projections. The query MUST NOT be sent to the server, placed in the URL, written to logs, or persisted. Search SHALL work while offline after unlock.

#### Scenario: No network request
- **WHEN** the user types a query
- **THEN** no vault or search request is made to the server

#### Scenario: Offline search
- **WHEN** the app is offline with a cached unlocked projection
- **THEN** search returns matching cached items

#### Scenario: Query privacy
- **WHEN** search runs
- **THEN** the query does not appear in the URL, history, or server logs

### Requirement: Performance budget

Search SHALL produce results within 100ms for 1000 decrypted items after the debounce. The palette MAY cap rendered rows but MUST report the total match count.

#### Scenario: Large vault
- **WHEN** 1000 decrypted items are searched
- **THEN** matching completes within the 100ms budget

#### Scenario: Capped rendering
- **WHEN** more matches exist than the render cap
- **THEN** the palette renders the cap and announces the total count

### Requirement: Accessible palette

The palette SHALL have an accessible name, a labelled search input, active-result semantics, and no critical or serious axe violations.

#### Scenario: Accessibility scan
- **WHEN** the palette is open with results
- **THEN** axe reports no critical or serious violation

#### Scenario: Active result
- **WHEN** keyboard navigation moves through results
- **THEN** the active option state is exposed to assistive technology
