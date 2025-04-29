import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// This component redirects to sign-in if not authenticated
const AuthRedirect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // List of paths that don't require authentication
    const authPaths = ['/sign-in', '/sign-up', '/auth/callback', '/oauth-callback', '/signin'];
    
    // Check if current path is in the auth paths list
    const isAuthPath = authPaths.some(path => location.pathname.startsWith(path));
    
    // If not authenticated and not on an auth path, redirect to sign-in
    if (!isAuthenticated && !isAuthPath) {
      console.log('Not authenticated, redirecting to sign-in page from:', location.pathname);
      navigate('/sign-in', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  // This component doesn't render anything
  return null;
};

export default AuthRedirect;
