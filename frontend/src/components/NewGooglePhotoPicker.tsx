import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Card,
  CardMedia,
  CardActionArea,
} from '@mui/material';

// Google OAuth client ID
const CLIENT_ID = '438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com';

// We'll use the current origin as the redirect URI

// Create a properly typed Grid item component
const GridItem = (props: any) => {
  const { children, ...other } = props;
  return (
    <Grid item {...other}>
      {children}
    </Grid>
  );
};

interface GooglePhotoPickerProps {
  onSelectImage: (imageBlob: Blob) => void;
}

interface Album {
  id: string;
  title: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: number;
}

interface Photo {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
}

const NewGooglePhotoPicker: React.FC<GooglePhotoPickerProps> = ({ onSelectImage }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  useEffect(() => {
    // Check if we're returning from an OAuth redirect
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');

    if (token) {
      console.log('Received access token from URL fragment');
      setAccessToken(token);
      setIsAuthenticated(true);

      // Clear the URL fragment
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check if we have a token in localStorage
      const storedToken = localStorage.getItem('googleAccessToken');
      if (storedToken) {
        console.log('Found access token in localStorage');
        setAccessToken(storedToken);
        setIsAuthenticated(true);
      }
    }

    // Log the current URL for debugging
    console.log('Current URL:', window.location.href);
    console.log('Current origin:', window.location.origin);
  }, []);

  // Save token to localStorage when it changes
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('googleAccessToken', accessToken);
    }
  }, [accessToken]);

  const initiateOAuth2Flow = () => {
    try {
      // Clear any existing tokens first
      localStorage.removeItem('googleAccessToken');
      localStorage.removeItem('googleRefreshToken');
      localStorage.removeItem('googleTokenExpiry');
      setAccessToken(null);

      // Redirect to the backend OAuth endpoint
      const backendUrl = `${API_URL}/auth/google`;
      console.log('Redirecting to backend OAuth URL:', backendUrl);
      window.location.href = backendUrl;
    } catch (err) {
      console.error('Error initiating OAuth flow:', err);
      setError('Failed to start Google authentication');
    }
  };

  const handleOpenPicker = async () => {
    setIsOpen(true);
    setError(null);
    await fetchAlbums();
  };

  const handleClosePicker = () => {
    setIsOpen(false);
    setSelectedAlbumId('');
    setPhotos([]);
  };

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(window.location.origin)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  const handleAlbumChange = async (event: SelectChangeEvent<string>) => {
    const albumId = event.target.value;
    setSelectedAlbumId(albumId);

    if (albumId) {
      await fetchPhotosFromAlbum(albumId);
    } else {
      setPhotos([]);
    }
  };

  const fetchAlbums = async () => {
    try {
      setLoadingAlbums(true);
      setError(null);

      console.log('Fetching albums...');

      if (!accessToken) {
        console.log('No access token found, user needs to authenticate first');
        setError('Please authenticate with Google first');
        setLoadingAlbums(false);
        return;
      }

      // Use our backend endpoint to fetch albums
      const response = await fetch(`${API_URL}/google-photos/albums?token=${encodeURIComponent(accessToken)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API request failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Albums API response:', data);

      if (data && data.albums && data.albums.length > 0) {
        setAlbums(data.albums);
        console.log(`Loaded ${data.albums.length} albums`);
      } else {
        setAlbums([]);
        console.log('No albums found or empty response');
      }
    } catch (err: any) {
      console.error('Error fetching albums:', err);
      let errorMessage = 'Failed to load albums from Google Photos';
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      setError(errorMessage);

      // If we get a 401 error, the token is likely expired
      if (err.message && err.message.includes('401')) {
        localStorage.removeItem('googleAccessToken');
        setAccessToken(null);
        setIsAuthenticated(false);
      }
    } finally {
      setLoadingAlbums(false);
    }
  };

  const fetchPhotosFromAlbum = async (albumId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching photos from album ${albumId}...`);

      if (!accessToken) {
        console.log('No access token found, user needs to authenticate first');
        setError('Please authenticate with Google first');
        setLoading(false);
        return;
      }

      // Use our backend endpoint to fetch photos from an album
      const response = await fetch(`${API_URL}/google-photos/media-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: accessToken,
          albumId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API request failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Album photos API response:', data);

      if (data && data.mediaItems && data.mediaItems.length > 0) {
        setPhotos(data.mediaItems);
        console.log(`Loaded ${data.mediaItems.length} photos from album`);
      } else {
        setPhotos([]);
        console.log('No photos found in album or empty response');
      }
    } catch (err: any) {
      console.error('Error fetching photos from album:', err);
      let errorMessage = 'Failed to load photos from album';
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      setError(errorMessage);

      // If we get a 401 error, the token is likely expired
      if (err.message && err.message.includes('401')) {
        localStorage.removeItem('googleAccessToken');
        setAccessToken(null);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhoto = async (photo: Photo) => {
    try {
      setLoading(true);
      console.log('Selected photo:', photo);

      // Make sure we have a baseUrl
      if (!photo.baseUrl) {
        throw new Error('Photo does not have a baseUrl');
      }

      if (!accessToken) {
        throw new Error('No access token available. Please sign in again.');
      }

      // Use our backend proxy to fetch the image
      try {
        // Create a more robust URL for the proxy
        const imageUrl = `${photo.baseUrl}=w2048-h2048`;
        const proxyUrl = `${API_URL}/proxy/google-photos?url=${encodeURIComponent(imageUrl)}&token=${encodeURIComponent(accessToken)}`;

        console.log('Fetching image through proxy:', proxyUrl);

        const response = await fetch(proxyUrl);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Proxy request failed: ${response.status} - ${errorText}`);
        }

        const blob = await response.blob();
        console.log('Image blob received:', blob);

        // Create a File object from the blob
        const file = new File([blob], `google-photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

        onSelectImage(file);
        handleClosePicker();
      } catch (fetchError: any) {
        console.error('Error fetching image through proxy:', fetchError);
        setError(`Failed to download the image: ${fetchError.message}`);
      }
    } catch (err: any) {
      console.error('Error selecting photo:', err);
      setError(`Failed to select the photo: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {!isAuthenticated ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography variant="body1" gutterBottom>
            Connect to Google Photos to select images
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={initiateOAuth2Flow}
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
            onClick={() => {
              localStorage.removeItem('googleAccessToken');
              localStorage.removeItem('googleRefreshToken');
              localStorage.removeItem('googleTokenExpiry');
              setAccessToken(null);
              setIsAuthenticated(false);
              setPhotos([]);
            }}
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
        <DialogTitle>Select a Photo from Google Photos</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
              {error.includes('401') && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={initiateOAuth2Flow}
                  sx={{ ml: 2 }}
                >
                  Re-authenticate
                </Button>
              )}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 3, mt: 1 }}>
            <InputLabel id="album-select-label">Select Album</InputLabel>
            <Select
              labelId="album-select-label"
              value={selectedAlbumId}
              label="Select Album"
              onChange={handleAlbumChange}
              disabled={loadingAlbums}
            >
              <MenuItem value="">
                <em>Select an album</em>
              </MenuItem>
              {albums.map((album) => (
                <MenuItem key={album.id} value={album.id}>
                  {album.title} {album.mediaItemsCount ? `(${album.mediaItemsCount})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {loadingAlbums && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {photos.map((photo) => (
                <GridItem xs={6} sm={4} md={3} key={photo.id}>
                  <Card>
                    <CardActionArea onClick={() => handleSelectPhoto(photo)}>
                      <CardMedia
                        component="img"
                        height="140"
                        image={`${photo.baseUrl}=w240-h140`}
                        alt={photo.filename}
                        sx={{ objectFit: 'cover' }}
                      />
                    </CardActionArea>
                  </Card>
                </GridItem>
              ))}
              {photos.length === 0 && selectedAlbumId && !loading && (
                <GridItem xs={12}>
                  <Typography variant="body1" align="center" sx={{ my: 4 }}>
                    No photos found in this album
                  </Typography>
                </GridItem>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePicker} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NewGooglePhotoPicker;
