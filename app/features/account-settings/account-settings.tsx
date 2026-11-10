import type { AccountSettingsProps } from './account-settings.types';
import { AccountSettingsPanel } from './components';

export const AccountSettings = ({ email, displayName, twoFactor, password }: AccountSettingsProps) => (
  <AccountSettingsPanel email={email} displayName={displayName} twoFactor={twoFactor} password={password} />
);
