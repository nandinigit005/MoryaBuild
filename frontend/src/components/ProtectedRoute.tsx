import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthRole, AuthApiError, clearAuthSession, getCurrentUser, getStoredAuthSession } from '../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

interface RoleProtectedRouteProps extends ProtectedRouteProps {
  allowedRoles: AuthRole[];
  redirectTo?: string;
}

interface RoleSwitchProps {
  client: React.ReactNode;
  contractor: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    let active = true;
    const session = getStoredAuthSession();
    if (!session?.token) {
      setState('invalid');
      return () => { active = false; };
    }

    void getCurrentUser()
      .then(() => { if (active) setState('valid'); })
      .catch((error) => {
        if (error instanceof AuthApiError && (error.status === 401 || error.status === 403)) clearAuthSession();
        if (active) setState('invalid');
      });

    return () => { active = false; };
  }, []);

  if (state === 'checking') {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">Validating session...</div>;
  }

  if (state === 'invalid') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ children, allowedRoles, redirectTo = '/client-portal' }) => {
  const session = getStoredAuthSession();
  if (!session?.user || !allowedRoles.includes(session.user.role)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
};

export const RoleSwitch: React.FC<RoleSwitchProps> = ({ client, contractor }) =>
  getStoredAuthSession()?.user.role === 'CLIENT' ? <>{client}</> : <>{contractor}</>;
