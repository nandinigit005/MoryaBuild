export type AuthRole = 'ADMIN' | 'PROJECT_MANAGER' | 'CLIENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
}

export interface AuthSession {
  token: string;
  expiresIn: string;
  user: AuthUser;
}

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

const AUTH_STORAGE_KEY = 'morya_auth_session_v1';
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api';

export const getStoredAuthSession = (): AuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const saveAuthSession = (session: AuthSession) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const loginWithBackend = async (email: string, password: string): Promise<AuthSession> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AuthApiError(data?.error || 'Login failed. Please try again.', response.status);
  }

  const session: AuthSession = {
    token: data.token,
    expiresIn: data.expiresIn,
    user: data.user,
  };

  saveAuthSession(session);
  return session;
};

export const registerClientWithBackend = async (payload: { name: string; email: string; password: string; phone?: string; clientName?: string }): Promise<AuthSession> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(data?.error || 'Registration failed. Please try again.', response.status);
  }

  const session: AuthSession = { token: data.token, expiresIn: data.expiresIn, user: data.user };
  saveAuthSession(session);
  return session;
};

export const getCurrentUser = async (): Promise<AuthUser> => {
  const session = getStoredAuthSession();
  if (!session?.token) throw new AuthApiError('Authentication required.', 401);

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${session.token}` },
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(data?.error || 'Session validation failed.', response.status);
  }

  const refreshedSession = { ...session, user: data.user };
  saveAuthSession(refreshedSession);
  return data.user as AuthUser;
};

export const logout = () => {
  clearAuthSession();
};
