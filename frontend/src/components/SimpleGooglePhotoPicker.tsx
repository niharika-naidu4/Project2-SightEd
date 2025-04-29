import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardMedia,
  CardActionArea,
  CircularProgress,
  Alert,
  Grid,
  Paper
} from '@mui/material';

interface SimpleGooglePhotoPickerProps {
  onSelectImage: (imageBlob: Blob) => void;
  onError?: () => void;
}

interface Photo {
  id: string;
  baseUrl: string;
  filename: string;
}

const SimpleGooglePhotoPicker: React.FC<SimpleGooglePhotoPickerProps> = ({ onSelectImage, onError }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Check if we have a valid token on component mount
  useEffect(() => {
    const token = localStorage.getItem('googleAccessToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Simple function to authenticate with Google
  const handleAuth = () => {
    // Clear any existing tokens
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');

    // Open Google auth in a new window
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authWindow = window.open(
      `${API_URL}/auth/google-simple`,
      'Google Auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Poll for the auth window to close
    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkClosed);

        // Check if we have a token in localStorage (should be set by the auth window)
        const token = localStorage.getItem('googleAccessToken');
        if (token) {
          setIsAuthenticated(true);
        } else {
          setError('Authentication failed. Please try again.');
          // Notify parent component about the error
          if (onError) {
            onError();
          }
        }
      }
    }, 500);
  };

  // Function to sign out from Google
  const handleSignOut = () => {
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');
    setIsAuthenticated(false);
    setPhotos([]);
  };

  const handleOpenPicker = async () => {
    setIsOpen(true);
    setError(null);
    await fetchPhotos();
  };

  const handleClosePicker = () => {
    setIsOpen(false);
    setPhotos([]);
  };

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        setError('Please authenticate with Google first');
        setLoading(false);
        return;
      }

      // Fetch photos through our backend proxy
      const response = await fetch(`${API_URL}/google-photos/recent?token=${encodeURIComponent(token)}`);

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid or expired
          localStorage.removeItem('googleAccessToken');
          setIsAuthenticated(false);
          throw new Error('Your authentication has expired. Please sign in again.');
        }

        if (response.status === 403) {
          // Access denied - likely OAuth configuration issue
          if (onError) {
            onError();
          }
          throw new Error('Access denied. Google Photos integration is currently unavailable.');
        }

        const errorText = await response.text();
        throw new Error(`Failed to fetch photos: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data && data.mediaItems && data.mediaItems.length > 0) {
        setPhotos(data.mediaItems);
      } else {
        setPhotos([]);
        setError('No photos found in your Google Photos account');
      }
    } catch (err: any) {
      console.error('Error fetching photos:', err);
      setError(err.message || 'Failed to load photos');

      // Check if this is an OAuth error
      if (err.message && (
        err.message.includes('access_denied') ||
        err.message.includes('OAuth') ||
        err.message.includes('Authentication failed') ||
        err.message.includes('Access denied')
      )) {
        if (onError) {
          onError();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhoto = async (photo: Photo) => {
    try {
      setLoading(true);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        throw new Error('No access token available. Please sign in again.');
      }

      // Use our backend proxy to fetch the image
      const proxyUrl = `${API_URL}/proxy/google-photo?id=${encodeURIComponent(photo.id)}&token=${encodeURIComponent(token)}`;

      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      onSelectImage(blob);
      handleClosePicker();
    } catch (err: any) {
      console.error('Error selecting photo:', err);
      setError(err.message || 'Failed to select photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {!isAuthenticated ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography variant="body1">
            Connect to Google Photos to select images
          </Typography>
          <Alert severity="info" sx={{ mb: 2, maxWidth: 450 }}>
            <Typography variant="body2">
              Important: You need to add <strong>http://localhost:5001/auth/google-simple/callback</strong> as an authorized redirect URI in your Google Cloud Console.
            </Typography>
          </Alert>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAuth}
          >
            Sign in with Google
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleOpenPicker}
            sx={{ mt: 2 }}
          >
            Select from Google Photos
          </Button>
          <Button
            variant="text"
            color="secondary"
            onClick={handleSignOut}
            size="small"
          >
            Sign out from Google Photos
          </Button>
        </Box>
      )}

      <Dialog
        open={isOpen}
        onClose={handleClosePicker}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Select a photo from Google Photos</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              {photos.map((photo) => (
                <Box key={photo.id} sx={{ width: { xs: '45%', sm: '30%', md: '22%' } }}>
                  <Card>
                    <CardActionArea onClick={() => handleSelectPhoto(photo)}>
                      <CardMedia
                        component="img"
                        height="140"
                        image={`${photo.baseUrl}=w220-h140`}
                        alt={photo.filename || 'Google Photo'}
                      />
                    </CardActionArea>
                  </Card>
                </Box>
              ))}
              {photos.length === 0 && !loading && !error && (
                <Box sx={{ width: '100%', textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No photos found
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePicker}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SimpleGooglePhotoPicker;
