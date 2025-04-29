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
  Breadcrumbs,
  Link,
  IconButton,
  Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface PopupGooglePhotoPickerProps {
  onSelectImage: (imageBlob: Blob) => void;
  onError?: () => void;
}

interface Photo {
  id: string;
  baseUrl: string;
  filename: string;
}

interface Album {
  id: string;
  title: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: number;
}

const PopupGooglePhotoPicker: React.FC<PopupGooglePhotoPickerProps> = ({ onSelectImage, onError }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedAlbumTitle, setSelectedAlbumTitle] = useState<string>('');
  const [view, setView] = useState<'albums' | 'photos'>('albums');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Check for an existing token on component mount
  useEffect(() => {
    const token = localStorage.getItem('googleAccessToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Use the backend OAuth flow instead of direct client-side flow
  const handleAuth = () => {
    // Clear any existing tokens
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');

    // Set a flag to detect verification errors
    localStorage.setItem('googleAuthAttempt', Date.now().toString());

    // Store the current URL so we can return here after authentication
    localStorage.setItem('googleAuthReturnUrl', window.location.href);

    // Use the backend OAuth endpoint which will handle the redirect properly
    const backendAuthUrl = `${API_URL}/auth/google`;
    console.log('Redirecting to backend OAuth URL:', backendAuthUrl);

    // Redirect to the backend OAuth endpoint
    window.location.href = backendAuthUrl;
  };

  const handleSignOut = () => {
    // Clear all Google-related data from localStorage
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');
    localStorage.removeItem('googleAuthAttempt');

    // Reset component state
    setIsAuthenticated(false);
    setPhotos([]);
    setAlbums([]);
    setSelectedAlbumId(null);
    setSelectedAlbumTitle('');
    setView('albums');
    setError(null);

    // Create an iframe to clear Google's authentication cookies
    // This helps ensure the next sign-in will prompt for account selection
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://accounts.google.com/logout';
    document.body.appendChild(iframe);

    // Remove the iframe after it has loaded
    iframe.onload = () => {
      setTimeout(() => {
        document.body.removeChild(iframe);
        console.log('Google sign-out iframe removed');
      }, 1000);
    };

    console.log('Successfully signed out from Google Photos');
  };

  const handleSwitchAccount = () => {
    // First sign out
    handleSignOut();

    // Then trigger the authentication flow with account selection forced
    setTimeout(() => {
      handleAuth();
    }, 500);
  };

  const handleOpenPicker = async () => {
    setIsOpen(true);
    setError(null);
    setView('albums');
    setSelectedAlbumId(null);
    setSelectedAlbumTitle('');
    await fetchAlbums();
  };

  const handleClosePicker = () => {
    setIsOpen(false);
    setPhotos([]);
    setAlbums([]);
    setSelectedAlbumId(null);
    setSelectedAlbumTitle('');
    setView('albums');
  };

  const handleBackToAlbums = () => {
    setView('albums');
    setSelectedAlbumId(null);
    setSelectedAlbumTitle('');
    setPhotos([]);
  };

  const handleSelectAlbum = async (album: Album) => {
    setSelectedAlbumId(album.id);
    setSelectedAlbumTitle(album.title);
    setView('photos');
    await fetchPhotosFromAlbum(album.id);
  };

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
        // Use the backend proxy instead of direct API call
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
        // Use the backend proxy instead of direct API call
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
        // Use the backend proxy instead of direct API call
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
          setError('No photos found in this album');
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

  const handleSelectPhoto = async (photo: Photo) => {
    try {
      setLoading(true);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        throw new Error('No access token available. Please sign in again.');
      }

      console.log('Selecting photo with ID:', photo.id);
      console.log('Photo base URL:', photo.baseUrl);

      // Skip direct fetch and always use the proxy for reliability
      // Use our backend proxy to fetch the image
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
    <Box>
      {!isAuthenticated ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography variant="body1">
            Connect to Google Photos to select images
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAuth}
            startIcon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18" />}
          >
            Sign in with Google
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleOpenPicker}
            fullWidth
            sx={{ mt: 2 }}
          >
            Select from Google Photos
          </Button>

          <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mt: 1 }}>
            <Button
              variant="text"
              color="primary"
              onClick={handleSwitchAccount}
              size="small"
              sx={{ fontSize: '0.75rem' }}
            >
              Switch Account
            </Button>

            <Button
              variant="text"
              color="secondary"
              onClick={handleSignOut}
              size="small"
              sx={{ fontSize: '0.75rem' }}
            >
              Sign Out
            </Button>
          </Box>
        </Box>
      )}

      <Dialog
        open={isOpen}
        onClose={handleClosePicker}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {view === 'photos' && selectedAlbumId ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={handleBackToAlbums} sx={{ mr: 1 }}>
                <ArrowBackIcon />
              </IconButton>
              <Breadcrumbs aria-label="breadcrumb">
                <Link
                  component="button"
                  underline="hover"
                  color="inherit"
                  onClick={handleBackToAlbums}
                  sx={{ cursor: 'pointer' }}
                >
                  Albums
                </Link>
                <Typography color="text.primary">{selectedAlbumTitle}</Typography>
              </Breadcrumbs>
            </Box>
          ) : (
            'Select an album from Google Photos'
          )}
        </DialogTitle>
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
          ) : view === 'albums' ? (
            // Albums View
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              {albums.length > 0 ? (
                albums.map((album) => (
                  <Box key={album.id} sx={{ width: { xs: '45%', sm: '30%', md: '22%' } }}>
                    <Card>
                      <CardActionArea onClick={() => handleSelectAlbum(album)}>
                        <CardMedia
                          component="img"
                          height="140"
                          image={album.coverPhotoBaseUrl ? `${album.coverPhotoBaseUrl}=w220-h140` : 'https://via.placeholder.com/220x140?text=No+Cover'}
                          alt={album.title || 'Album'}
                        />
                        <Box sx={{ p: 1 }}>
                          <Typography variant="subtitle2" noWrap>
                            {album.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {album.mediaItemsCount || 0} items
                          </Typography>
                        </Box>
                      </CardActionArea>
                    </Card>
                  </Box>
                ))
              ) : (
                <Box sx={{ width: '100%', textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No albums found. We'll show your recent photos instead.
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            // Photos View
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              {photos.length > 0 ? (
                photos.map((photo) => (
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
                ))
              ) : (
                <Box sx={{ width: '100%', textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No photos found in this album. Please select another album.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Want to use a different account? Close and click "Switch Account"
          </Typography>
          <Button onClick={handleClosePicker}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PopupGooglePhotoPicker;
