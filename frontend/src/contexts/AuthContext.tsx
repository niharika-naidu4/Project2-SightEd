import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => void;
}

interface User {
  email: string;
  firstName?: string;
  lastName?: string;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      // Check if this is a Google authentication
      const isGoogleAuth = password === 'google-auth';

      if (isGoogleAuth) {
        // Handle Google authentication
        const user = {
          email,
          firstName: email.split('@')[0],
          isGoogleUser: true
        };

        // Save to localStorage
        localStorage.setItem('user', JSON.stringify(user));

        // Update state
        setUser(user);
        setIsAuthenticated(true);
        return;
      }

      // Regular email/password login - call the backend API
      console.log('Attempting to login with email:', email);

      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://sighted-backend-c4pxtrk7la-uc.a.run.app'}/api/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        console.log('Login response status:', response.status);

        // Get the response text first
        const responseText = await response.text();
        console.log('Login response text:', responseText);

        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse response as JSON:', e);
          throw new Error('Invalid response from server');
        }

        if (!response.ok) {
          throw new Error(data.details || 'Login failed');
        }

        // Save user data to localStorage
        console.log('Saving user data:', data.user);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Update state
        setUser(data.user);
        setIsAuthenticated(true);

        console.log('Login successful:', data.message);
      } catch (innerError) {
        console.error('Error during login API call:', innerError);
        throw innerError;
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Signup function
  const signup = async (userData: SignupData) => {
    try {
      // Call the backend API to register the user
      console.log('Attempting to register user:', userData.email);

      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://sighted-backend-c4pxtrk7la-uc.a.run.app'}/api/users/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        });

        console.log('Registration response status:', response.status);

        // Get the response text first
        const responseText = await response.text();
        console.log('Registration response text:', responseText);

        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse response as JSON:', e);
          throw new Error('Invalid response from server');
        }

        if (!response.ok) {
          throw new Error(data.details || 'Registration failed');
        }

        // Save user data to localStorage
        console.log('Saving user data:', data.user);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Update state
        setUser(data.user);
        setIsAuthenticated(true);

        console.log('Registration successful:', data.message);
      } catch (innerError) {
        console.error('Error during registration API call:', innerError);
        throw innerError;
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    // Remove from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');

    // Update state
    setUser(null);
    setIsAuthenticated(false);

    console.log('User logged out successfully');
  };

  const value = {
    isAuthenticated,
    user,
    login,
    signup,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
