import { subscribeOutboxEvents } from './outbox';
import { syncVault } from './sync';

export const runVaultSync = (): Promise<void> => syncVault().then(() => undefined);

export const subscribeOutbox = subscribeOutboxEvents;
