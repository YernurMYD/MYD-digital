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

export enum ScreenStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline',
}
