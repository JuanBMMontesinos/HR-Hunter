export type UserRole = 'Admin' | 'Gerente' | 'Recrutador' | 'Consultor' | 'GestorRH';

export type PermissionResource =
  | 'companies'
  | 'job_openings'
  | 'candidates'
  | 'processes'
  | 'users'
  | 'settings'
  | 'dashboard';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export type PermissionKey = `${PermissionResource}:${PermissionAction}` | (string & {});

export interface UserDto {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  department?: string | null;
  managerId?: number | null;
  isActive: boolean;
  preferredLanguage?: string | null;
  lastLogin?: string | null;
  isPasswordResetRequired?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthSessionData {
  accessToken: string;
  expiresIn: string;
  user: UserDto;
  permissions: PermissionKey[];
}

export interface PermissionsResponseData {
  role: UserRole;
  permissions: PermissionKey[];
  details?: Array<{
    id: number;
    resource: PermissionResource;
    action: PermissionAction;
    description?: string;
    key: PermissionKey;
  }>;
  ttlSeconds?: number;
}

export interface NotificationItem {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsListData {
  items: NotificationItem[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
