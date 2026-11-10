type AdminUserView = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  twoFactorEnabled: number;
  createdAt: number;
};

type PendingInvitationView = {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'member';
  expires_at: number;
  created_at: number;
};

export type AdminUsersPageData = {
  users: AdminUserView[];
  invitations: PendingInvitationView[];
  currentUserId: string;
};

export type InvitationResult =
  { status: 'ok'; setupUrl: string } | { status: 'user-exists' } | { status: 'conflict' } | { status: 'server-error' };

export type UserMutationResult = 'ok' | 'not-found' | 'last-admin' | 'self';
