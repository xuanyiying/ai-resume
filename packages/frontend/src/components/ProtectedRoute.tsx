import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'USER' | 'ADMIN';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, token, user, setAuth, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      // If already authenticated with a token, just verify it once
      if (isAuthenticated && token) {
        try {
          // Verify token is still valid
          const currentUser = await authService.getCurrentUser();
          setAuth(currentUser, token);
        } catch (error) {
          // Token is invalid, clear auth
          console.log('Token verification failed');
          clearAuth();
        } finally {
          setLoading(false);
        }
      } else {
        // No auth, stop loading
        setLoading(false);
      }
    };

    verifyAuth();
  }, []); // Run only once on mount

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && user?.role !== requiredRole) {
    // If user is logged in but doesn't have the required role, redirect to home
    // Ideally this should be a 403 Forbidden page
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
