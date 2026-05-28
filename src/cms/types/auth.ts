export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  AGENT = 'agent',
  CLIENT = 'client',
  ACCOUNTANT = 'accountant',
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  ARCHIVED = 'archived',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: AccountStatus;
  organizationId: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Администратор',
  [UserRole.OPERATOR]: 'Оператор',
  [UserRole.AGENT]: 'Агент',
  [UserRole.CLIENT]: 'Клиент',
  [UserRole.ACCOUNTANT]: 'Бухгалтер',
};

export const STATUS_LABELS: Record<AccountStatus, string> = {
  [AccountStatus.ACTIVE]: 'Активен',
  [AccountStatus.SUSPENDED]: 'Заблокирован',
  [AccountStatus.PENDING]: 'Ожидает',
  [AccountStatus.ARCHIVED]: 'Архивирован',
};
