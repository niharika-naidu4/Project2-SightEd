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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Divider
} from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import { gapi } from 'gapi-script';

// Google Photos API scopes
const SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly';
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || '';
const CLIENT_ID = '438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com'; // Use the provided client ID

interface GooglePhotoPickerProps {
  onSelectImage: (imageBlob: Blob) => void;
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

const GooglePhotoPicker: React.FC<GooglePhotoPickerProps> = ({ onSelectImage }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Component mounted, checking for tokens...');

    // Check if we're returning from an OAuth redirect first
    const hasToken = handleOAuth2Callback();
    console.log('Token in URL:', hasToken ? 'Yes' : 'No');

    if (hasToken) {
      console.log('Successfully processed OAuth callback');
    } else {
      // Check if we have a valid access token in localStorage
      const accessToken = localStorage.getItem('googleAccessToken');
      console.log('Token in localStorage (googleAccessToken):', accessToken ? 'Found' : 'Not found');

      // Also check the older token storage
      const oldToken = localStorage.getItem('googleToken');
      console.log('Token in localStorage (googleToken):', oldToken ? 'Found' : 'Not found');

      const tokenExpiry = localStorage.getItem('googleTokenExpiry');
      console.log('Token expiry in localStorage:', tokenExpiry);

      if (accessToken) {
        // Check if the token is expired
        if (tokenExpiry) {
          const expiryTime = parseInt(tokenExpiry);
          const now = Date.now();
          console.log('Current time:', now, 'Expiry time:', expiryTime);

          if (now >= expiryTime) {
            // Token is expired, clear it and require re-authentication
            console.log('Access token has expired, clearing token');
            localStorage.removeItem('googleAccessToken');
            localStorage.removeItem('googleToken');
            localStorage.removeItem('googleTokenExpiry');
            setIsAuthenticated(false);
          } else {
            // Token is still valid
            console.log('Found valid access token in localStorage');
            setIsAuthenticated(true);
          }
        } else {
          // No expiry time, assume token is valid
          console.log('Found access token in localStorage (no expiry time)');
          setIsAuthenticated(true);
        }
      } else if (oldToken) {
        // We have an old token, use it and copy it to the new key
        console.log('Using old token format, copying to new format');
        localStorage.setItem('googleAccessToken', oldToken);
        setIsAuthenticated(true);
      } else {
        // No token found
        console.log('No token found in localStorage');
        setIsAuthenticated(false);
      }
    }

    // Initialize the Google API (just for basic setup)
    const initGoogleAPI = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          gapi.load('client', {
            callback: resolve,
            onerror: reject,
          });
        });

        // Just initialize with the API key, we'll handle auth separately
        await gapi.client.init({
          apiKey: API_KEY,
        });

        console.log('Google API initialized');
      } catch (error) {
        console.error('Error initializing Google API:', error);
        setError('Failed to initialize Google API');
      }
    };

    if (CLIENT_ID && API_KEY) {
      initGoogleAPI();
    } else {
      console.warn('Google API credentials are missing. Please check your .env file.');
    }
  }, []);

  // This function initiates the OAuth 2.0 flow directly
  const initiateOAuth2Flow = () => {
    try {
      // Clear any existing tokens first
      localStorage.removeItem('googleAccessToken');
      localStorage.removeItem('googleToken');
      localStorage.removeItem('googleTokenExpiry');

      // Define the OAuth 2.0 parameters
      const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';

      // Parameters for the OAuth 2.0 request
      const params = {
        client_id: CLIENT_ID,
        redirect_uri: 'http://localhost:3000', // Hardcode the redirect URI to match what's in Google Cloud Console
        response_type: 'token', // We want an access token
        scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
        include_granted_scopes: 'true',
        state: 'pass-through-value',
        prompt: 'select_account consent', // Force account selection and consent screen
        access_type: 'online',
      };

      // Build the OAuth 2.0 authorization URL
      let oauth2Url = `${oauth2Endpoint}?`;
      for (const p in params) {
        oauth2Url += `${p}=${encodeURIComponent(params[p as keyof typeof params])}&`;
      }

      // Redirect the user to the OAuth 2.0 authorization URL
      console.log('Redirecting to OAuth URL:', oauth2Url);
      window.location.href = oauth2Url;
    } catch (err) {
      console.error('Error initiating OAuth flow:', err);
      setError('Failed to start Google authentication');
    }
  };

  // This function handles the OAuth 2.0 callback
  const handleOAuth2Callback = () => {
    try {
      // Check if we have an access token in the URL fragment
      const hash = window.location.hash.substring(1);
      console.log('URL hash:', hash);

      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const expiresIn = params.get('expires_in');
      const error = params.get('error');

      if (error) {
        console.error('OAuth error:', error);
        setError(`Authentication error: ${error}`);
        return false;
      }

      if (accessToken) {
        console.log('Received access token from URL fragment');

        // Store the access token
        localStorage.setItem('googleAccessToken', accessToken);

        // For backward compatibility
        localStorage.setItem('googleToken', accessToken);

        // Calculate and store the expiry time if available
        if (expiresIn) {
          const expiryTime = Date.now() + (parseInt(expiresIn) * 1000);
          localStorage.setItem('googleTokenExpiry', expiryTime.toString());
          console.log(`Token will expire in ${expiresIn} seconds (${new Date(expiryTime).toLocaleString()})`);
        }

        setIsAuthenticated(true);

        // Clear the URL fragment
        window.history.replaceState({}, document.title, window.location.pathname);

        console.log('Authentication successful, token stored');
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error handling OAuth callback:', err);
      setError('Failed to process Google authentication response');
      return false;
    }
  };

  // This is still needed for the GoogleLogin component
  const handleAuthSuccess = async (credentialResponse: any) => {
    try {
      console.log('Google auth success:', credentialResponse);

      // For now, we'll just use our direct OAuth flow instead
      initiateOAuth2Flow();
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Failed to authenticate with Google');
    }
  };



  const handleAuthError = () => {
    setError('Google authentication failed');
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

      // Get the access token
      let token = localStorage.getItem('googleAccessToken');
      console.log('Token from localStorage (googleAccessToken):', token ? 'Found' : 'Not found');

      const tokenExpiry = localStorage.getItem('googleTokenExpiry');
      console.log('Token expiry from localStorage:', tokenExpiry);

      // Check if token is expired
      if (token && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        const now = Date.now();
        console.log('Current time:', now, 'Expiry time:', expiryTime);

        if (now >= expiryTime) {
          // Token is expired, clear it
          console.log('Access token has expired, clearing token');
          localStorage.removeItem('googleAccessToken');
          localStorage.removeItem('googleTokenExpiry');
          token = null;
          setIsAuthenticated(false);
        }
      }

      // Fallback to older token storage if needed
      if (!token) {
        token = localStorage.getItem('googleToken');
        console.log('Token from localStorage (googleToken):', token ? 'Found' : 'Not found');
      }

      if (!token) {
        console.log('No valid token found, user needs to authenticate first');
        setError('Please authenticate with Google first');
        setLoadingAlbums(false);
        return;
      }

      console.log('Using token (first 10 chars):', token.substring(0, 10) + '...');

      // Skip gapi initialization and use direct fetch
      console.log('Making direct fetch request to Google Photos API...');

      // Fetch albums using direct fetch
      const response = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);

        // If unauthorized, clear the token and set not authenticated
        if (response.status === 401) {
          console.log('Token is invalid or expired, clearing token');
          localStorage.removeItem('googleAccessToken');
          localStorage.removeItem('googleToken');
          localStorage.removeItem('googleTokenExpiry');
          setIsAuthenticated(false);
          throw new Error(`Authentication failed: ${errorText}`);
        }

        throw new Error(`API request failed: ${response.status} - ${errorText}`);
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
      } else if (typeof err === 'object' && err !== null) {
        errorMessage += `: ${JSON.stringify(err)}`;
      } else {
        errorMessage += ': Unknown error';
      }
      setError(errorMessage);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const fetchPhotosFromAlbum = async (albumId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching photos from album ${albumId}...`);

      // Get the access token
      let token = localStorage.getItem('googleAccessToken');
      console.log('Token from localStorage (googleAccessToken):', token ? 'Found' : 'Not found');

      const tokenExpiry = localStorage.getItem('googleTokenExpiry');
      console.log('Token expiry from localStorage:', tokenExpiry);

      // Check if token is expired
      if (token && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        const now = Date.now();
        console.log('Current time:', now, 'Expiry time:', expiryTime);

        if (now >= expiryTime) {
          // Token is expired, clear it
          console.log('Access token has expired, clearing token');
          localStorage.removeItem('googleAccessToken');
          localStorage.removeItem('googleToken');
          localStorage.removeItem('googleTokenExpiry');
          token = null;
          setIsAuthenticated(false);
        }
      }

      // Fallback to older token storage if needed
      if (!token) {
        token = localStorage.getItem('googleToken');
        console.log('Token from localStorage (googleToken):', token ? 'Found' : 'Not found');
      }

      if (!token) {
        console.log('No valid token found, user needs to authenticate first');
        setError('Please authenticate with Google first');
        setLoading(false);
        return;
      }

      console.log('Using token (first 10 chars):', token.substring(0, 10) + '...');

      // Make a POST request to search for media items in the album
      console.log('Making POST request to Google Photos API...');

      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          albumId: albumId,
          pageSize: 100
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);

        // If unauthorized, clear the token and set not authenticated
        if (response.status === 401) {
          console.log('Token is invalid or expired, clearing token');
          localStorage.removeItem('googleAccessToken');
          localStorage.removeItem('googleToken');
          localStorage.removeItem('googleTokenExpiry');
          setIsAuthenticated(false);
          throw new Error(`Authentication failed: ${errorText}`);
        }

        throw new Error(`API request failed: ${response.status} - ${errorText}`);
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
      } else if (typeof err === 'object' && err !== null) {
        errorMessage += `: ${JSON.stringify(err)}`;
      } else {
        errorMessage += ': Unknown error';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Attempting to fetch photos...');

      // First check for an access token (preferred)
      let token = localStorage.getItem('googleAccessToken');

      // If no access token, try the ID token as fallback
      if (!token) {
        token = localStorage.getItem('googleToken');
      }

      if (!token) {
        console.log('No token found, user needs to authenticate first');
        setError('Please authenticate with Google first');
        setLoading(false);
        return;
      }

      console.log('User is authenticated, loading Photos API...');

      // Initialize the gapi client
      await new Promise<void>((resolve, reject) => {
        gapi.load('client', {
          callback: resolve,
          onerror: reject,
        });
      });

      // Initialize the client with API key
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/photoslibrary/v1/rest'],
      });

      // Set the auth token directly
      gapi.client.setToken({
        access_token: token
      });

      console.log('Photos API loaded, fetching media items...');

      // Make a direct fetch request instead of using gapi.client
      // This gives us more control over the headers
      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Photos API response:', data);

      if (data && data.mediaItems && data.mediaItems.length > 0) {
        setPhotos(data.mediaItems);
        console.log(`Loaded ${data.mediaItems.length} photos`);
      } else {
        setPhotos([]);
        console.log('No photos found or empty response');
        console.log('Response details:', data);
      }
    } catch (err: any) {
      console.error('Error fetching photos:', err);
      // More detailed error message
      let errorMessage = 'Failed to load photos from Google Photos';
      if (err.message) {
        errorMessage += `: ${err.message}`;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage += `: ${JSON.stringify(err)}`;
      } else {
        errorMessage += ': Unknown error';
      }
      setError(errorMessage);
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

      // Get the access token
      const accessToken = localStorage.getItem('googleAccessToken');
      if (!accessToken) {
        throw new Error('No access token available. Please sign in again.');
      }

      // Use our improved backend proxy to fetch the image and avoid CORS issues
      try {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
        console.log('API_URL value:', API_URL);

        // Create a more robust URL for the proxy
        const imageUrl = `${photo.baseUrl}=w2048-h2048`;
        const proxyUrl = `${API_URL}/proxy/google-photos?url=${encodeURIComponent(imageUrl)}&token=${encodeURIComponent(accessToken)}`;

        console.log('Fetching image through proxy:', proxyUrl);

        // Skip the download link approach as it's not working properly
        // Instead, directly fetch the image
        console.log('Directly fetching image...');

        const response = await fetch(proxyUrl);
        console.log('Proxy response status:', response.status);
        console.log('Proxy response headers:', response.headers);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Proxy error response:', errorText);
          throw new Error(`Proxy request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const blob = await response.blob();
        console.log('Image blob received:', blob);
        console.log('Blob type:', blob.type);
        console.log('Blob size:', blob.size);

        // Create a File object from the blob
        const file = new File([blob], `google-photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

        onSelectImage(file);
        handleClosePicker();
      } catch (fetchError) {
        console.error('Error fetching image through proxy:', fetchError);

        // Fallback: Try direct download
        try {
          // Create a direct download link to the Google Photos image
          const downloadLink = document.createElement('a');
          downloadLink.href = `${photo.baseUrl}=w2048-h2048-d`;
          downloadLink.download = `google-photo-${Date.now()}.jpg`;
          downloadLink.target = '_blank';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);

          setError('Could not automatically process the image. Please save it manually and upload it.');
        } catch (openError) {
          console.error('Error with direct download:', openError);
          setError('Failed to access the image. Please try a different photo or method.');
        }
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
          <Typography variant="body1">
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
        <Button
          variant="outlined"
          color="primary"
          onClick={handleOpenPicker}
          sx={{ mt: 2 }}
        >
          Select from Google Photos
        </Button>
      )}

      <Dialog
        open={isOpen}
        onClose={handleClosePicker}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Select a photo from Google Photos</DialogTitle>
        <DialogContent>
          {loadingAlbums ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Loading albums...</Typography>
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <>
              <Box sx={{ mb: 3, mt: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="album-select-label">Select Album</InputLabel>
                  <Select
                    labelId="album-select-label"
                    id="album-select"
                    value={selectedAlbumId}
                    label="Select Album"
                    onChange={handleAlbumChange}
                    disabled={loading}
                  >
                    <MenuItem value="">
                      <em>Select an album</em>
                    </MenuItem>
                    {albums.map((album) => (
                      <MenuItem key={album.id} value={album.id}>
                        {album.title} {album.mediaItemsCount ? `(${album.mediaItemsCount} items)` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                  <Typography sx={{ ml: 2 }}>Loading photos...</Typography>
                </Box>
              ) : selectedAlbumId ? (
                photos.length === 0 ? (
                  <Typography>No photos found in this album</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
                    {photos.map((photo) => (
                      <Card key={photo.id}>
                        <CardActionArea onClick={() => handleSelectPhoto(photo)}>
                          <CardMedia
                            component="img"
                            height="140"
                            image={`${photo.baseUrl}=w400-h400`}
                            alt={photo.filename || 'Photo'}
                          />
                        </CardActionArea>
                      </Card>
                    ))}
                  </Box>
                )
              ) : (
                <Typography>Please select an album to view photos</Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePicker}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GooglePhotoPicker;
