import type { AdminUsersPageData } from './admin-users.types';
import { AdminUsersPanel } from './components';

export const AdminUsers = (data: AdminUsersPageData) => <AdminUsersPanel data={data} />;
