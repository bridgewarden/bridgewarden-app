# offline-pwa Specification

## Purpose
Defines installability and offline shell behavior without caching vault data or API responses.

## Requirements

### Requirement: Web app manifest

The app SHALL expose a web manifest with name, short name, standalone display, theme color, `start_url` `/app`, and valid icons. The app MUST be installable where the browser supports installation.

#### Scenario: Manifest fetch
- **WHEN** the browser requests the manifest
- **THEN** it returns valid install metadata and icons

#### Scenario: Install
- **WHEN** the install criteria are met
- **THEN** the browser offers installation

### Requirement: Versioned offline shell

A service worker SHALL precache the app shell and static assets under a versioned cache. Navigations SHALL use network-first with an offline shell fallback. `/api/*` and vault data MUST NOT be cached.

#### Scenario: Offline reload
- **WHEN** the network is unavailable and the shell is cached
- **THEN** the shell boots and displays the locked overlay if the key is absent

#### Scenario: API bypass
- **WHEN** the service worker sees an `/api/*` request
- **THEN** it does not serve a cached response

#### Scenario: Vault data source
- **WHEN** the app is offline
- **THEN** vault content comes only from IndexedDB, never the service worker cache

### Requirement: Update prompt

A new service worker version SHALL activate without silently replacing a running session, and the UI SHALL offer a reload/update action.

#### Scenario: New deployment
- **WHEN** a new worker is waiting
- **THEN** the app shows an update prompt and applies it only on user action

#### Scenario: Update accepted
- **WHEN** the user accepts the update
- **THEN** the new worker activates and the page reloads once
