# copy-catalog Specification

## Purpose
Provides a single English source for every user-facing string plus a typed lookup, so components
never hardcode copy and a second locale can be added later without editing the UI.

## Requirements

### Requirement: Single copy source

All user-facing strings in the application SHALL come from one English catalog, and components
MUST NOT contain hardcoded user-facing text other than values supplied at runtime.

#### Scenario: Rendered heading

- **WHEN** a page renders a heading or button label
- **THEN** the text is resolved from the catalog rather than written in the component

#### Scenario: New string

- **WHEN** a developer needs a new user-facing string
- **THEN** adding it requires a catalog entry, not an inline literal in a component

### Requirement: Typed lookup

The catalog SHALL expose a typed lookup so an unknown key is rejected at build time rather than
discovered at runtime.

#### Scenario: Unknown key

- **WHEN** code references a key that does not exist in the catalog
- **THEN** type checking fails before the application can be built

### Requirement: Parameter interpolation

The lookup SHALL support named parameters so counts, names, and addresses can be inserted without
string concatenation in components.

#### Scenario: Count with plural forms

- **WHEN** a message is rendered with a count parameter
- **THEN** the selected wording matches the count and the number appears in the output

#### Scenario: Name insertion

- **WHEN** a message is rendered with a name parameter
- **THEN** the resolved string contains the supplied value exactly once in the intended position

### Requirement: Missing key behavior

The lookup SHALL throw in development when a key is missing, and in production SHALL return the
key text without crashing the page and without exposing internal state.

#### Scenario: Missing key in development

- **WHEN** a component renders a key that is absent from the catalog during development
- **THEN** the lookup throws a message that names the missing key

#### Scenario: Missing key in production

- **WHEN** a component renders a key that is absent from the catalog in production
- **THEN** the page still renders, showing the key text, and logs no user or vault data

### Requirement: Locale-ready structure

The catalog SHALL isolate locale-specific text from components so a second locale can be added by
adding catalog data only.

#### Scenario: Adding a locale

- **WHEN** a second locale is introduced
- **THEN** no component file requires modification to display that locale
