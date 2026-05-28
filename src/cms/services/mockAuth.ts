import { UserRole, AccountStatus, type User, type CreateUserPayload } from '../types/auth';

const STORAGE_KEY = 'myd_mock_users';
const SESSION_KEY = 'myd_mock_session';

const DEFAULT_USERS: User[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@mydigital.kz',
    firstName: 'Ернур',
    lastName: 'Админов',
    phone: '+7 (777) 111-11-11',
    role: UserRole.ADMIN,
    status: AccountStatus.ACTIVE,
    organizationId: 'org-1',
    lastLoginAt: new Date().toISOString(),
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'operator@mydigital.kz',
    firstName: 'Алия',
    lastName: 'Оператова',
    phone: '+7 (777) 222-22-22',
    role: UserRole.OPERATOR,
    status: AccountStatus.ACTIVE,
    organizationId: 'org-1',
    lastLoginAt: '2026-05-27T14:30:00Z',
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-02-01T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'agent@mydigital.kz',
    firstName: 'Тимур',
    lastName: 'Агентов',
    phone: '+7 (777) 333-33-33',
    role: UserRole.AGENT,
    status: AccountStatus.ACTIVE,
    organizationId: 'org-1',
    lastLoginAt: '2026-05-26T09:15:00Z',
    createdAt: '2025-03-10T10:00:00Z',
    updatedAt: '2025-03-10T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'client@mydigital.kz',
    firstName: 'Марат',
    lastName: 'Клиентов',
    phone: '+7 (777) 444-44-44',
    role: UserRole.CLIENT,
    status: AccountStatus.ACTIVE,
    organizationId: 'org-1',
    lastLoginAt: '2026-05-25T16:00:00Z',
    createdAt: '2025-04-20T10:00:00Z',
    updatedAt: '2025-04-20T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'accountant@mydigital.kz',
    firstName: 'Дана',
    lastName: 'Бухгалтерова',
    phone: '+7 (777) 555-55-55',
    role: UserRole.ACCOUNTANT,
    status: AccountStatus.ACTIVE,
    organizationId: 'org-1',
    lastLoginAt: null,
    createdAt: '2025-05-05T10:00:00Z',
    updatedAt: '2025-05-05T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'blocked@mydigital.kz',
    firstName: 'Аскар',
    lastName: 'Заблокиров',
    phone: '+7 (777) 666-66-66',
    role: UserRole.AGENT,
    status: AccountStatus.SUSPENDED,
    organizationId: 'org-1',
    lastLoginAt: '2026-04-10T11:00:00Z',
    createdAt: '2025-06-15T10:00:00Z',
    updatedAt: '2026-04-10T11:00:00Z',
  },
];

const MOCK_PASSWORDS: Record<string, string> = {
  'admin@mydigital.kz': 'Admin123!',
  'operator@mydigital.kz': 'Oper123!',
  'agent@mydigital.kz': 'Agent123!',
  'client@mydigital.kz': 'Client123!',
  'accountant@mydigital.kz': 'Account123!',
  'blocked@mydigital.kz': 'Block123!',
};

function getUsers(): User[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* fall through */
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
  return [...DEFAULT_USERS];
}

function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getPasswords(): Record<string, string> {
  const stored = localStorage.getItem('myd_mock_passwords');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* fall through */
    }
  }
  localStorage.setItem('myd_mock_passwords', JSON.stringify(MOCK_PASSWORDS));
  return { ...MOCK_PASSWORDS };
}

function savePasswords(passwords: Record<string, string>): void {
  localStorage.setItem('myd_mock_passwords', JSON.stringify(passwords));
}

function delay(ms = 400): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const mockAuth = {
  async login(email: string, password: string): Promise<User> {
    await delay();

    const users = getUsers();
    const passwords = getPasswords();
    const user = users.find((u) => u.email === email);

    if (!user || passwords[email] !== password) {
      throw { status: 401, message: 'Неверный email или пароль' };
    }

    if (user.status === AccountStatus.SUSPENDED) {
      throw { status: 403, message: 'Аккаунт заблокирован. Обратитесь к администратору' };
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw { status: 403, message: 'Аккаунт не активен' };
    }

    user.lastLoginAt = new Date().toISOString();
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, user.id);
    return user;
  },

  async logout(): Promise<void> {
    await delay(200);
    localStorage.removeItem(SESSION_KEY);
  },

  async getSession(): Promise<User | null> {
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) return null;

    const users = getUsers();
    return users.find((u) => u.id === userId) ?? null;
  },

  async getUsers(): Promise<User[]> {
    await delay(300);
    return getUsers();
  },

  async createUser(payload: CreateUserPayload): Promise<User> {
    await delay(500);

    const users = getUsers();
    const passwords = getPasswords();

    if (users.some((u) => u.email === payload.email)) {
      throw { status: 409, message: 'Пользователь с таким email уже существует' };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      role: payload.role,
      status: AccountStatus.ACTIVE,
      organizationId: 'org-1',
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);
    passwords[payload.email] = payload.password;
    saveUsers(users);
    savePasswords(passwords);
    return newUser;
  },

  async toggleStatus(userId: string): Promise<User> {
    await delay(300);

    const users = getUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      throw { status: 404, message: 'Пользователь не найден' };
    }

    user.status =
      user.status === AccountStatus.ACTIVE
        ? AccountStatus.SUSPENDED
        : AccountStatus.ACTIVE;
    user.updatedAt = new Date().toISOString();

    saveUsers(users);
    return user;
  },
};
