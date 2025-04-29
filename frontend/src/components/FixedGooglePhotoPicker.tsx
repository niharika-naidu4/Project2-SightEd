import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  Tabs,
  Tab,
  Alert,
  Card,
  CardMedia,
  CardActionArea,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GoogleIcon from '@mui/icons-material/Google';

// Define types
interface Photo {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
  mediaMetadata: {
    width: string;
    height: string;
    creationTime: string;
  };
}

interface Album {
  id: string;
  title: string;
  productUrl?: string; // Make this optional for our mock data
  mediaItemsCount: string;
  coverPhotoBaseUrl?: string;
  coverPhotoMediaItemId?: string;
}

interface FixedGooglePhotoPickerProps {
  open: boolean;
  onClose: () => void;
  onSelectImage: (blob: Blob) => void;
  onError?: () => void;
}

const FixedGooglePhotoPicker: React.FC<FixedGooglePhotoPickerProps> = ({
  open,
  onClose,
  onSelectImage,
  onError
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'albums' | 'photos'>('albums');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Check if the user is already authenticated
  useEffect(() => {
    const token = localStorage.getItem('googleAccessToken');
    if (token) {
      // Check if token is expired
      const expiryTime = localStorage.getItem('googleTokenExpiry');
      if (expiryTime && parseInt(expiryTime) > Date.now()) {
        setIsAuthenticated(true);
        console.log('User is already authenticated with Google');
      } else {
        // Token is expired, remove it
        localStorage.removeItem('googleAccessToken');
        localStorage.removeItem('googleTokenExpiry');
        console.log('Google token is expired, removed from storage');
      }
    }
  }, []);

  // When authenticated, fetch albums
  useEffect(() => {
    if (isAuthenticated && open) {
      fetchAlbums();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, open]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 0) {
      setView('albums');
    } else {
      setView('photos');
      fetchPhotos();
    }
  };

  // Handle authentication with Google
  const handleAuth = () => {
    // Clear any existing tokens
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');

    // Set a flag to detect verification errors
    localStorage.setItem('googleAuthAttempt', Date.now().toString());

    // Use the simple OAuth flow with a popup window
    const backendAuthUrl = `${API_URL}/auth/google-simple`;
    console.log('Opening popup with backend OAuth URL:', backendAuthUrl);

    // Open a popup window for authentication
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authWindow = window.open(
      backendAuthUrl,
      'Google Auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!authWindow) {
      setError('Popup blocked! Please allow popups for this site to use Google Photos.');
      return;
    }

    // Poll for the auth window to close or for token to appear
    const checkInterval = setInterval(() => {
      try {
        // Check if the popup is closed
        if (authWindow.closed) {
          clearInterval(checkInterval);

          // Check if we have a token in localStorage (set by the popup)
          const token = localStorage.getItem('googleAccessToken');
          if (token) {
            console.log('Found token in localStorage after auth window closed');
            setIsAuthenticated(true);
          } else {
            setError('Authentication failed or was cancelled. Please try again.');
          }
        }
      } catch (e) {
        // If we can't access the window, it might be on a different domain due to redirects
        // Just continue polling
      }
    }, 500);
  };

  // Handle closing the picker
  const handleClosePicker = () => {
    setError(null);
    setSelectedAlbum(null);
    setView('albums');
    setTabValue(0);
    onClose();
  };

  // Fetch albums from Google Photos
  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        setError('Please authenticate with Google first');
        setLoading(false);
        return;
      }

      console.log('Fetching albums with token (first 10 chars):', token.substring(0, 10) + '...');

      try {
        // Use the backend proxy
        const response = await fetch(`${API_URL}/google-photos/albums?token=${encodeURIComponent(token)}`);

        console.log('Backend proxy albums response status:', response.status);

        if (!response.ok) {
          if (response.status === 401) {
            // Token is invalid or expired
            localStorage.removeItem('googleAccessToken');
            setIsAuthenticated(false);
            throw new Error('Your authentication has expired. Please sign in again.');
          }

          if (response.status === 403) {
            // Permission denied - likely insufficient scopes
            localStorage.removeItem('googleAccessToken');
            setIsAuthenticated(false);
            throw new Error('Insufficient permissions. Please sign in again and approve all requested permissions.');
          }

          const errorData = await response.json();
          console.error('Error response from backend proxy:', errorData);
          throw new Error(`Failed to fetch albums: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('Successfully fetched albums. Count:', data.albums?.length || 0);

        if (data && data.albums && data.albums.length > 0) {
          setAlbums(data.albums);
        } else {
          setAlbums([]);
          // If no albums, fetch recent photos instead
          console.log('No albums found, fetching recent photos instead');
          setView('photos');
          setTabValue(1);
          await fetchPhotos();
        }
      } catch (apiError: any) {
        console.error('API Error:', apiError);
        throw apiError;
      }
    } catch (err: any) {
      console.error('Error fetching albums:', err);
      setError(err.message || 'Failed to load albums');

      // Check if this is an OAuth error
      if (err.message && (
        err.message.includes('access_denied') ||
        err.message.includes('OAuth') ||
        err.message.includes('Authentication failed')
      )) {
        if (onError) {
          onError();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent photos from Google Photos
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

      console.log('Fetching recent photos with token (first 10 chars):', token.substring(0, 10) + '...');

      try {
        // Use the backend proxy
        const response = await fetch(`${API_URL}/google-photos/recent?token=${encodeURIComponent(token)}`);

        console.log('Backend proxy photos response status:', response.status);

        if (!response.ok) {
          if (response.status === 401) {
            // Token is invalid or expired
            localStorage.removeItem('googleAccessToken');
            setIsAuthenticated(false);
            throw new Error('Your authentication has expired. Please sign in again.');
          }

          if (response.status === 403) {
            // Permission denied - likely insufficient scopes
            localStorage.removeItem('googleAccessToken');
            setIsAuthenticated(false);
            throw new Error('Insufficient permissions. Please sign in again and approve all requested permissions.');
          }

          let errorMessage = `Failed to fetch photos: ${response.status}`;
          try {
            const errorData = await response.json();
            console.error('Error response from backend proxy:', errorData);
            errorMessage += ` - ${JSON.stringify(errorData)}`;
          } catch (e) {
            const errorText = await response.text();
            console.error('Error response from backend proxy (text):', errorText);
            errorMessage += ` - ${errorText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Successfully fetched photos. Count:', data.mediaItems?.length || 0);

        if (data && data.mediaItems && data.mediaItems.length > 0) {
          setPhotos(data.mediaItems);
        } else {
          setPhotos([]);
          setError('No photos found in your Google Photos account');
        }
      } catch (apiError: any) {
        console.error('API Error:', apiError);
        throw apiError;
      }
    } catch (err: any) {
      console.error('Error fetching photos:', err);
      setError(err.message || 'Failed to load photos');

      // Check if this is an OAuth error
      if (err.message && (
        err.message.includes('access_denied') ||
        err.message.includes('OAuth') ||
        err.message.includes('Authentication failed')
      )) {
        if (onError) {
          onError();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch photos from an album using Google Photos API
  const fetchPhotosFromAlbum = async (albumId: string) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        setError('Please authenticate with Google first');
        setLoading(false);
        return;
      }

      console.log(`Fetching photos from album ${albumId} with token (first 10 chars):`, token.substring(0, 10) + '...');

      try {
        // Use the backend proxy
        const response = await fetch(`${API_URL}/google-photos/media-items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            albumId: albumId
          })
        });

        console.log('Backend proxy album photos response status:', response.status);

        if (!response.ok) {
          if (response.status === 401) {
            // Token is invalid or expired
            localStorage.removeItem('googleAccessToken');
            setIsAuthenticated(false);
            throw new Error('Your authentication has expired. Please sign in again.');
          }

          if (response.status === 403) {
            // Permission denied - likely insufficient scopes
            localStorage.removeItem('googleAccessToken');
            setIsAuthenticated(false);
            throw new Error('Insufficient permissions. Please sign in again and approve all requested permissions.');
          }

          let errorMessage = `Failed to fetch album photos: ${response.status}`;
          try {
            const errorData = await response.json();
            console.error('Error response from backend proxy:', errorData);
            errorMessage += ` - ${JSON.stringify(errorData)}`;
          } catch (e) {
            const errorText = await response.text();
            console.error('Error response from backend proxy (text):', errorText);
            errorMessage += ` - ${errorText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Successfully fetched album photos. Count:', data.mediaItems?.length || 0);

        if (data && data.mediaItems && data.mediaItems.length > 0) {
          setPhotos(data.mediaItems);
        } else {
          setPhotos([]);
          setError('No photos found in this album. Please select another album.');
        }
      } catch (apiError: any) {
        console.error('API Error:', apiError);
        throw apiError;
      }
    } catch (err: any) {
      console.error('Error fetching album photos:', err);
      setError(err.message || 'Failed to load album photos');
    } finally {
      setLoading(false);
    }
  };

  // Handle album selection
  const handleSelectAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setView('photos');
    fetchPhotosFromAlbum(album.id);
  };

  // Handle back button click
  const handleBackToAlbums = () => {
    setSelectedAlbum(null);
    setView('albums');
    setTabValue(0);
    setError(null);
  };

  // Handle photo selection using Google Photos API
  const handleSelectPhoto = async (photo: Photo) => {
    try {
      setLoading(true);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        throw new Error('No access token available. Please sign in again.');
      }

      console.log('Selecting photo with ID:', photo.id);
      console.log('Photo base URL:', photo.baseUrl);

      // Use the backend proxy to fetch the image
      const proxyUrl = `${API_URL}/proxy/google-photos?url=${encodeURIComponent(photo.baseUrl)}&token=${encodeURIComponent(token)}`;
      console.log('Fetching image through proxy:', proxyUrl);

      const response = await fetch(proxyUrl);
      console.log('Proxy response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid or expired
          localStorage.removeItem('googleAccessToken');
          setIsAuthenticated(false);
          throw new Error('Your authentication has expired. Please sign in again.');
        }

        if (response.status === 403) {
          // Permission denied - likely insufficient scopes
          localStorage.removeItem('googleAccessToken');
          setIsAuthenticated(false);
          throw new Error('Insufficient permissions to access this photo. Please sign in again and approve all requested permissions.');
        }

        let errorMessage = `Failed to fetch image: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('Error response from backend proxy:', errorData);
          errorMessage += ` - ${JSON.stringify(errorData)}`;
        } catch (e) {
          try {
            const errorText = await response.text();
            console.error('Error response from backend proxy (text):', errorText);
            errorMessage += ` - ${errorText}`;
          } catch (textError) {
            console.error('Could not read error response body');
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      console.log('Successfully fetched image through proxy, blob size:', blob.size);

      if (blob.size === 0) {
        throw new Error('Received empty image data. Please try again or select a different photo.');
      }

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
    <Dialog
      open={open}
      onClose={handleClosePicker}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '700px',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center">
          {view === 'photos' && selectedAlbum && (
            <IconButton onClick={handleBackToAlbums} edge="start" sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          )}
          {selectedAlbum ? `Photos in ${selectedAlbum.title}` : 'Google Photos'}
        </Box>
        <IconButton onClick={handleClosePicker} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {!isAuthenticated ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            gap={2}
          >
            <Typography variant="h6" align="center" gutterBottom>
              Connect to Google Photos
            </Typography>
            <Typography variant="body1" align="center" color="textSecondary" paragraph>
              Sign in with your Google account to access your photos
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<GoogleIcon />}
              onClick={handleAuth}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Sign in with Google'}
            </Button>
          </Box>
        ) : (
          <>
            {view === 'albums' && (
              <>
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  indicatorColor="primary"
                  textColor="primary"
                  variant="fullWidth"
                  sx={{ mb: 2 }}
                >
                  <Tab label="Albums" />
                  <Tab label="Recent Photos" />
                </Tabs>

                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <CircularProgress />
                  </Box>
                ) : error ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                    {albums.map((album) => (
                      <Box key={album.id}>
                        <Card
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: 'pointer',
                            '&:hover': {
                              boxShadow: 6
                            }
                          }}
                          onClick={() => handleSelectAlbum(album)}
                        >
                          <CardActionArea>
                            <CardMedia
                              component="img"
                              height="140"
                              image={album.coverPhotoBaseUrl || 'https://via.placeholder.com/150'}
                              alt={album.title}
                            />
                            <Box p={1}>
                              <Typography variant="subtitle2" noWrap>
                                {album.title}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {album.mediaItemsCount} items
                              </Typography>
                            </Box>
                          </CardActionArea>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}

            {view === 'photos' && (
              <>
                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <CircularProgress />
                  </Box>
                ) : error ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                    {photos.map((photo) => (
                      <Box key={photo.id}>
                        <Card
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: 'pointer',
                            '&:hover': {
                              boxShadow: 6
                            }
                          }}
                          onClick={() => handleSelectPhoto(photo)}
                        >
                          <CardActionArea>
                            <CardMedia
                              component="img"
                              height="140"
                              image={`${photo.baseUrl}=w220-h220`}
                              alt={photo.filename}
                            />
                            <Box p={1}>
                              <Typography variant="caption" color="textSecondary" noWrap>
                                {photo.filename}
                              </Typography>
                            </Box>
                          </CardActionArea>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClosePicker} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FixedGooglePhotoPicker;
