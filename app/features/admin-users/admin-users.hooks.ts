import { useFetcher } from 'react-router';

type AdminMutation = { ok: true } | { ok: false; error: string };
type InvitationResponse = { ok: true; setupUrl: string } | { ok: false; error: string };

export const useAdminUsers = () => {
  const invitation = useFetcher<InvitationResponse>();
  const mutation = useFetcher<AdminMutation>();
  const invitationMutation = useFetcher<AdminMutation>();
  const setupUrl = invitation.data?.ok ? invitation.data.setupUrl : null;

  return {
    invitation,
    mutation,
    invitationMutation,
    setupUrl,
    createInvitation: (input: { email: string; displayName: string; role: 'admin' | 'member' }) =>
      invitation.submit(input, { method: 'post', action: '/admin/users/invite', encType: 'application/json' }),
    mutate: (path: string, input: Record<string, string> = {}) =>
      mutation.submit(input, { method: 'post', action: path, encType: 'application/json' }),
    revokeInvitation: (id: string) =>
      invitationMutation.submit({}, { method: 'post', action: `/admin/users/invitations/${id}/revoke` }),
  };
};
