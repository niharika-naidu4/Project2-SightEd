import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Layout from './components/Layout';
import Home from './pages/Home';
import Results from './pages/Results';
import Saved from './pages/Saved';
import Quiz from './pages/Quiz';
import OAuthCallback from './pages/OAuthCallback';
import MyCollectionPage from './pages/MyCollectionPage';
import ContactPage from './pages/ContactPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import AdminContactPage from './pages/AdminContactPage';
import ProtectedRoute from './components/ProtectedRoute';
import AuthRedirect from './components/AuthRedirect';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Get API keys from environment variables
const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Function to clean up localStorage to prevent quota issues
const cleanupStorage = () => {
  try {
    // Clean up old items from localStorage
    const savedItems = localStorage.getItem('savedItems');
    if (savedItems) {
      try {
        const parsedItems = JSON.parse(savedItems);

        // If we have more than 20 items, keep only the 20 most recent
        if (parsedItems.length > 20) {
          const recentItems = parsedItems.slice(-20);
          localStorage.setItem('savedItems', JSON.stringify(recentItems));
          console.log(`Cleaned up localStorage: removed ${parsedItems.length - 20} old items`);
        }
      } catch (error) {
        console.error('Error parsing saved items during cleanup:', error);
        // If we can't parse the items, clear the storage to prevent future errors
        localStorage.removeItem('savedItems');
      }
    }

    // Clean up sessionStorage
    const keys = Object.keys(sessionStorage);
    const imageKeys = keys.filter(key => key.startsWith('image-'));

    // If we have more than 10 images in sessionStorage, remove the oldest ones
    if (imageKeys.length > 10) {
      // Sort keys by timestamp (assuming keys are in format 'image-{timestamp}')
      imageKeys.sort();

      // Remove the oldest keys
      const keysToRemove = imageKeys.slice(0, imageKeys.length - 10);
      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });
      console.log(`Cleaned up sessionStorage: removed ${keysToRemove.length} old items`);
    }
  } catch (error) {
    console.error('Error during storage cleanup:', error);
  }
};

// Create a wrapper component for OAuth handling
const withOAuthHandler = (Component: React.ComponentType<any>) => {
  return (props: any) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { hash } = location;

    useEffect(() => {
      if (hash && hash.includes('access_token')) {
        // Parse the hash fragment
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const state = params.get('state');

        if (accessToken) {
          // Store the token
          localStorage.setItem('googleAccessToken', accessToken);
          console.log('Stored access token from hash fragment');

          // Clear the hash
          window.history.replaceState({}, document.title, window.location.pathname);

          // Redirect based on state parameter
          if (state === 'signin') {
            navigate('/sign-in');
          } else if (state === 'signup') {
            navigate('/sign-up');
          } else {
            // Just refresh the current page without the hash
            window.location.reload();
          }
        }
      }
    }, [hash, navigate]);

    return <Component {...props} />;
  };
};

// Create a component to handle OAuth hash fragments
const OAuthHandlerWrapper = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hash } = location;

  useEffect(() => {
    if (hash && hash.includes('access_token')) {
      // Parse the hash fragment
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const state = params.get('state');

      if (accessToken) {
        // Store the token
        localStorage.setItem('googleAccessToken', accessToken);
        console.log('Stored access token from hash fragment');

        // Clear the hash
        window.history.replaceState({}, document.title, window.location.pathname);

        // Redirect based on state parameter
        if (state === 'signin') {
          navigate('/sign-in');
        } else if (state === 'signup') {
          navigate('/sign-up');
        } else {
          // Just refresh the current page without the hash
          window.location.reload();
        }
      }
    }
  }, [hash, navigate]);

  return <>{children}</>; // Render children
};

function App() {
  // Run cleanup when the app starts
  useEffect(() => {
    cleanupStorage();

    // Check if we have an access token in the URL fragment (for OAuth redirect to root)
    const hash = window.location.hash.substring(1);
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');

      if (accessToken) {
        console.log('Found access token in URL fragment at root');
        localStorage.setItem('googleAccessToken', accessToken);

        // Calculate and store the expiry time if available
        const expiresIn = params.get('expires_in');
        if (expiresIn) {
          const expiryTime = Date.now() + (parseInt(expiresIn) * 1000);
          localStorage.setItem('googleTokenExpiry', expiryTime.toString());
        }

        // Clear the URL fragment
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            {/* Add the AuthRedirect component to handle authentication redirects */}
            <AuthRedirect />

            <Routes>
              {/* Authentication routes - always accessible */}
              <Route path="/sign-in/*" element={
                <OAuthHandlerWrapper>
                  <Layout><SignInPage /></Layout>
                </OAuthHandlerWrapper>
              } />
              <Route path="/sign-up/*" element={
                <OAuthHandlerWrapper>
                  <Layout><SignUpPage /></Layout>
                </OAuthHandlerWrapper>
              } />
              <Route path="/auth/callback" element={<OAuthCallback />} />
              <Route path="/oauth-callback" element={<OAuthCallback />} />

              {/* Public routes */}
              <Route path="/contact" element={
                <OAuthHandlerWrapper>
                  <Layout><ContactPage /></Layout>
                </OAuthHandlerWrapper>
              } />

              {/* Root route - redirects to sign-in if not authenticated */}
              <Route path="/" element={
                <OAuthHandlerWrapper>
                  <Layout>
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  </Layout>
                </OAuthHandlerWrapper>
              } />

              {/* Protected routes */}
              <Route path="/results" element={
                <OAuthHandlerWrapper>
                  <Layout>
                    <ProtectedRoute>
                      <Results />
                    </ProtectedRoute>
                  </Layout>
                </OAuthHandlerWrapper>
              } />
              <Route path="/saved" element={
                <OAuthHandlerWrapper>
                  <Layout>
                    <ProtectedRoute>
                      <Saved />
                    </ProtectedRoute>
                  </Layout>
                </OAuthHandlerWrapper>
              } />
              <Route path="/quiz" element={
                <OAuthHandlerWrapper>
                  <Layout>
                    <ProtectedRoute>
                      <Quiz />
                    </ProtectedRoute>
                  </Layout>
                </OAuthHandlerWrapper>
              } />
              <Route path="/my-collection" element={
                <OAuthHandlerWrapper>
                  <Layout>
                    <ProtectedRoute>
                      <MyCollectionPage />
                    </ProtectedRoute>
                  </Layout>
                </OAuthHandlerWrapper>
              } />

              {/* Admin routes */}
              <Route path="/admin/contact" element={
                <OAuthHandlerWrapper>
                  <Layout>
                    <ProtectedRoute>
                      <AdminContactPage />
                    </ProtectedRoute>
                  </Layout>
                </OAuthHandlerWrapper>
              } />

              {/* Legacy routes */}
              <Route path="/signin" element={
                <OAuthHandlerWrapper>
                  <Layout><SignInPage /></Layout>
                </OAuthHandlerWrapper>
              } />

              {/* Catch-all route - redirect to sign-in */}
              <Route path="*" element={<Navigate to="/sign-in" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
