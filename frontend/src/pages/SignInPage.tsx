import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Container,
  Paper,
  Divider,
  Link,
  CircularProgress,
  Alert,
  TextField
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Get the redirect path from location state or default to home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Handle sign in with email/password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Use the login function from the auth context
      await login(email, password);

      // Navigate to home page
      navigate('/');
    } catch (err: any) {
      console.error("Error signing in:", err);

      // Display the specific error message if available
      setError(err.message || "An error occurred during sign in. Please try again.");
      setIsSubmitting(false);
    }
  };



  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Sign In to SightEd
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Access your saved insights and personalized learning
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Sign In Form */}
        <Box component="form" onSubmit={handleSignIn} sx={{ mb: 4 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Sign In"
            )}
          </Button>
        </Box>

        {/* Alternative Sign In Methods */}


        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body1" gutterBottom>
            Don't have an account?
          </Typography>
          <Button
            variant="outlined"
            size="large"
            sx={{ mt: 1 }}
            component={Link}
            href="/sign-up"
          >
            Create Account
          </Button>
        </Box>


      </Paper>
    </Container>
  );
};

export default SignInPage;
