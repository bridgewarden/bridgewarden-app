import { MemberSetupPanel } from './components/member-setup-panel';

type MemberSetupProps = {
  valid: boolean;
  email?: string;
  displayName?: string;
  role?: string;
};

export const MemberSetup = ({ valid, email, displayName, role }: MemberSetupProps) => (
  <MemberSetupPanel
    invitation={valid && email && displayName ? { email, displayName, role: role ?? 'member' } : null}
  />
);
