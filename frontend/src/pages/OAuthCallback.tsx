import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const OAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const processOAuthCallback = async () => {
      try {
        // First check for token in URL hash (implicit flow)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        let accessToken = hashParams.get('access_token');
        let refreshToken = hashParams.get('refresh_token');
        let expiresIn = hashParams.get('expires_in');
        let error = hashParams.get('error');

        // If not in hash, check query parameters (authorization code flow)
        if (!accessToken && !error) {
          const queryParams = new URLSearchParams(location.search);
          accessToken = queryParams.get('access_token');
          refreshToken = queryParams.get('refresh_token');
          expiresIn = queryParams.get('expires_in');
          error = queryParams.get('error');
        }

        if (error) {
          setStatus('error');
          setErrorMessage(`Authentication failed: ${error}`);
          return;
        }

        if (!accessToken) {
          setStatus('error');
          setErrorMessage('No access token received');
          return;
        }

        // Store the tokens in localStorage
        localStorage.setItem('googleAccessToken', accessToken);

        if (refreshToken) {
          localStorage.setItem('googleRefreshToken', refreshToken);
        }

        if (expiresIn) {
          const expiryTime = Date.now() + (parseInt(expiresIn) * 1000);
          localStorage.setItem('googleTokenExpiry', expiryTime.toString());
        }

        // Set success status
        setStatus('success');

        // Also log the user in to our app's auth system
        try {
          // Extract email from token if available (in a real app, you'd decode the token or get user info)
          // For now, we'll use a placeholder email
          const email = 'google-user@example.com';
          await login(email, 'google-auth'); // Use a special password to indicate Google auth
        } catch (loginError) {
          console.error('Error logging in after Google auth:', loginError);
          // Continue anyway since we have the Google token
        }

        // Check if we have a return URL stored
        const returnUrl = localStorage.getItem('googleAuthReturnUrl');
        localStorage.removeItem('googleAuthReturnUrl'); // Clear it after use

        // Redirect back to the return URL or home page after a short delay
        setTimeout(() => {
          if (returnUrl) {
            window.location.href = returnUrl;
          } else {
            navigate('/');
          }
        }, 2000);
      } catch (error) {
        console.error('Error processing OAuth callback:', error);
        setStatus('error');
        setErrorMessage('Failed to process authentication response');
      }
    };

    processOAuthCallback();
  }, [location, navigate, login]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
        {status === 'processing' && (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6">Processing authentication...</Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <Typography variant="h6" color="primary" gutterBottom>
              Authentication Successful!
            </Typography>
            <Typography variant="body1">
              You have successfully authenticated with Google Photos.
            </Typography>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Redirecting you back to the application...
            </Typography>
          </>
        )}

        {status === 'error' && (
          <>
            <Typography variant="h6" color="error" gutterBottom>
              Authentication Failed
            </Typography>
            <Typography variant="body1">
              {errorMessage || 'An error occurred during authentication.'}
            </Typography>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Please try again or contact support if the issue persists.
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default OAuthCallback;
