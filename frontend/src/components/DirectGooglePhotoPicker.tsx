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
  Divider
} from '@mui/material';

interface DirectGooglePhotoPickerProps {
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
  productUrl?: string;
  isShared?: boolean;
}

const DirectGooglePhotoPicker: React.FC<DirectGooglePhotoPickerProps> = ({ onSelectImage }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'albums' | 'photos'>('albums');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CLIENT_ID = '438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com';
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Check for an existing token on component mount
  useEffect(() => {
    // Check if we have a token in the URL fragment (from OAuth redirect)
    const hash = window.location.hash.substring(1);
    console.log('URL hash:', hash);

    // Try different ways to extract the token
    let accessToken = null;

    // Method 1: Using URLSearchParams
    try {
      const params = new URLSearchParams(hash);
      accessToken = params.get('access_token');
      console.log('Method 1 - URLSearchParams result:', accessToken ? 'Token found' : 'No token');
    } catch (e) {
      console.error('Error parsing hash with URLSearchParams:', e);
    }

    // Method 2: Direct parsing
    if (!accessToken && hash.includes('access_token=')) {
      try {
        const tokenPart = hash.split('access_token=')[1];
        accessToken = tokenPart.split('&')[0];
        console.log('Method 2 - Direct parsing result:', accessToken ? 'Token found' : 'No token');
      } catch (e) {
        console.error('Error with direct parsing:', e);
      }
    }

    // Method 3: Check if the hash itself is the token
    if (!accessToken && hash.length > 20 && !hash.includes('=')) {
      accessToken = hash;
      console.log('Method 3 - Using hash as token');
    }

    if (accessToken) {
      console.log('Found access token in URL fragment (length):', accessToken.length);
      localStorage.setItem('googleAccessToken', accessToken);
      setIsAuthenticated(true);

      // Clear the URL fragment
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      console.log('No token found in URL fragment');

      // Check if we have a token in localStorage
      const storedToken = localStorage.getItem('googleAccessToken');
      if (storedToken) {
        console.log('Found access token in localStorage');
        setIsAuthenticated(true);
      } else {
        console.log('No token found in localStorage either');
      }
    }

    // Check for errors in localStorage
    const authError = localStorage.getItem('googleAuthError');
    if (authError) {
      console.log('Found auth error in localStorage:', authError);
      setError(authError);
      localStorage.removeItem('googleAuthError');
    }
  }, []);

  const handleAuth = (forceAccountSelection = true) => {
    setLoading(true);
    setError(null);

    // Clear any existing tokens
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');
    localStorage.removeItem('googleAuthError');

    try {
      // Use the Google Identity Services library
      // @ts-ignore - google is loaded from the script in index.html
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Error getting token:', tokenResponse);
            setLoading(false);
            setError('Error getting token: ' + tokenResponse.error);
            return;
          }

          console.log('Token received:', tokenResponse);

          // Store the token
          const token = tokenResponse.access_token;
          const expiresIn = tokenResponse.expires_in;
          const expiryTime = Date.now() + (expiresIn * 1000);

          localStorage.setItem('googleAccessToken', token);
          localStorage.setItem('googleTokenExpiry', expiryTime.toString());

          // Update state
          setIsAuthenticated(true);
          setLoading(false);

          // Fetch albums
          fetchAlbums();
        },
        prompt: forceAccountSelection ? 'select_account' : '',
        error_callback: (error: any) => {
          console.error('Error in authentication:', error);
          setLoading(false);
          setError('Error in authentication: ' + (error.type || error.message || 'Unknown error'));
        }
      });

      // Request the token
      client.requestAccessToken();
    } catch (error: any) {
      console.error('Error starting authentication:', error);
      setLoading(false);
      setError('Error starting authentication: ' + error.message);
    }
  };

  const handleOpenPicker = async () => {
    setIsOpen(true);
    setError(null);
    setViewMode('albums');
    setSelectedAlbumId('');
    setPhotos([]);

    // Check for errors in localStorage
    const authError = localStorage.getItem('googleAuthError');
    if (authError) {
      console.log('Found auth error in localStorage when opening picker:', authError);
      setError(authError);
      localStorage.removeItem('googleAuthError');
      return;
    }

    // Check if we have a token
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      console.log('No access token found, redirecting to auth');
      setError('No access token found. Redirecting to Google authentication...');

      // Short delay to show the error message before redirecting
      setTimeout(() => {
        handleAuth(true);
      }, 1500);
      return;
    }

    console.log('Found access token, fetching albums');
    setIsAuthenticated(true);
    await fetchAlbums();
  };

  const handleClosePicker = () => {
    setIsOpen(false);
    setPhotos([]);
    setAlbums([]);
    setSelectedAlbumId('');
    setViewMode('albums');
  };

  const handleBackToAlbums = () => {
    setViewMode('albums');
    setSelectedAlbumId('');
    setPhotos([]);
  };

  const handleSelectAlbum = async (albumId: string) => {
    setSelectedAlbumId(albumId);
    setViewMode('photos');
    await fetchPhotosFromAlbum(albumId);
  };

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        console.log('No access token found, redirecting to auth');
        handleAuth(true);
        return;
      }

      // Check if token is expired
      const expiryTime = localStorage.getItem('googleTokenExpiry');
      if (expiryTime && parseInt(expiryTime) < Date.now()) {
        console.log('Token has expired, redirecting to auth');
        handleAuth(true);
        return;
      }

      console.log('Fetching albums with token (first 10 chars):', token.substring(0, 10) + '...');
      console.log('Token length:', token.length);

      // Make a direct request to the Google Photos API to get albums
      const response = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Error response from Google Photos API:', response.status, response.statusText);

        if (response.status === 401) {
          // Token is invalid or expired
          console.log('Token is invalid or expired, clearing and redirecting');
          localStorage.removeItem('googleAccessToken');
          setIsAuthenticated(false);

          // Force a new authentication
          setTimeout(() => {
            handleAuth(true);
          }, 500);
          return;
        }

        try {
          // Try to parse the error as JSON
          const errorData = await response.json();
          console.error('Error response details:', errorData);

          // Check for specific error types
          if (errorData.error && errorData.error.status === 'PERMISSION_DENIED') {
            // This is a permissions issue
            console.log('Permission denied, clearing tokens and redirecting');
            localStorage.removeItem('googleAccessToken');
            localStorage.removeItem('googleTokenExpiry');
            setIsAuthenticated(false);

            // Force a new authentication with full permissions
            setTimeout(() => {
              handleAuth(true);
            }, 500);
            return;
          } else {
            throw new Error(`Failed to fetch albums: ${response.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (jsonError) {
          // If we can't parse as JSON, use the text
          const errorText = await response.text();
          throw new Error(`Failed to fetch albums: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('Albums data received:', data);

      // Log the full response for debugging
      console.log('Full albums response:', JSON.stringify(data, null, 2));

      // Check if we have albums or shared albums
      if (data && ((data.albums && data.albums.length > 0) || (data.sharedAlbums && data.sharedAlbums.length > 0))) {
        const albumsList = data.albums || [];
        const sharedAlbumsList = data.sharedAlbums || [];

        // Combine regular albums and shared albums
        const combinedAlbums = [...albumsList, ...sharedAlbumsList];

        console.log(`Found ${combinedAlbums.length} albums (${albumsList.length} regular, ${sharedAlbumsList.length} shared)`);
        setAlbums(combinedAlbums);
      } else {
        console.log('No albums found in response');
        console.log('Response keys:', Object.keys(data));

        // Check if there's any data we can use
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          console.log('Response has data but no albums array. Checking for alternative structures...');

          // Try to extract any album-like objects
          const possibleAlbums: Album[] = [];

          // Recursively search for objects with id and title properties
          const findAlbumObjects = (obj: any, path = '') => {
            if (!obj || typeof obj !== 'object') return;

            if (obj.id && obj.title) {
              console.log(`Found potential album at ${path}:`, obj);
              possibleAlbums.push(obj as Album);
            }

            for (const key in obj) {
              if (Array.isArray(obj[key])) {
                obj[key].forEach((item: any, index: number) => {
                  findAlbumObjects(item, `${path}.${key}[${index}]`);
                });
              } else if (typeof obj[key] === 'object') {
                findAlbumObjects(obj[key], `${path}.${key}`);
              }
            }
          };

          findAlbumObjects(data, 'data');

          if (possibleAlbums.length > 0) {
            console.log(`Found ${possibleAlbums.length} potential albums through deep search`);
            setAlbums(possibleAlbums);
            return;
          }
        }

        setAlbums([]);
        setError('No albums found in your Google Photos account. Please make sure you have created albums in Google Photos and granted permission to access them.');
      }
    } catch (err: any) {
      console.error('Error fetching albums:', err);
      setError(err.message || 'Failed to load albums');

      // If there's a serious error, offer to retry with a new authentication
      if (err.message && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('PERMISSION_DENIED')
      )) {
        setError(`${err.message}. Would you like to try signing in again?`);
        setIsAuthenticated(false);
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
        console.log('No access token found, redirecting to auth');
        handleAuth(true);
        return;
      }

      console.log(`Fetching photos from album ${albumId} with token (first 10 chars):`, token.substring(0, 10) + '...');

      // Make a direct request to the Google Photos API to get photos from an album
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

      if (!response.ok) {
        console.error('Error response from Google Photos API:', response.status, response.statusText);

        if (response.status === 401) {
          // Token is invalid or expired
          console.log('Token is invalid or expired, clearing and redirecting');
          localStorage.removeItem('googleAccessToken');
          setIsAuthenticated(false);

          // Force a new authentication
          setTimeout(() => {
            handleAuth(true);
          }, 500);
          return;
        }

        try {
          // Try to parse the error as JSON
          const errorData = await response.json();
          console.error('Error response details:', errorData);

          // Check for specific error types
          if (errorData.error && errorData.error.status === 'PERMISSION_DENIED') {
            // This is a permissions issue
            console.log('Permission denied, clearing tokens and redirecting');
            localStorage.removeItem('googleAccessToken');
            localStorage.removeItem('googleTokenExpiry');
            setIsAuthenticated(false);

            // Force a new authentication with full permissions
            setTimeout(() => {
              handleAuth(true);
            }, 500);
            return;
          } else {
            throw new Error(`Failed to fetch photos: ${response.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (jsonError) {
          // If we can't parse as JSON, use the text
          const errorText = await response.text();
          throw new Error(`Failed to fetch photos: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('Photos data received:', data);

      if (data && data.mediaItems && data.mediaItems.length > 0) {
        console.log(`Found ${data.mediaItems.length} photos in album`);
        setPhotos(data.mediaItems);
      } else {
        console.log('No photos found in album');
        setPhotos([]);
        setError('No photos found in this album. Please select a different album or add photos to this album in Google Photos.');
      }
    } catch (err: any) {
      console.error('Error fetching photos from album:', err);
      setError(err.message || 'Failed to load photos');

      // If there's a serious error, offer to retry with a new authentication
      if (err.message && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('PERMISSION_DENIED')
      )) {
        setError(`${err.message}. Would you like to try signing in again?`);
        setIsAuthenticated(false);
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

      // Make a direct request to the Google Photos API
      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid or expired
          localStorage.removeItem('googleAccessToken');
          setIsAuthenticated(false);
          throw new Error('Your authentication has expired. Please sign in again.');
        }

        try {
          // Try to parse the error as JSON
          const errorData = await response.json();
          console.error('Error response from Google Photos API:', errorData);

          // Check for specific error types
          if (errorData.error && errorData.error.status === 'PERMISSION_DENIED') {
            // This is a permissions issue
            localStorage.removeItem('googleAccessToken');
            localStorage.removeItem('googleTokenExpiry');
            setIsAuthenticated(false);
            throw new Error(`Insufficient permissions to access Google Photos. Please sign in again and approve all requested permissions. Error: ${errorData.error.message}`);
          } else {
            throw new Error(`Failed to fetch photos: ${response.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (jsonError) {
          // If we can't parse as JSON, use the text
          const errorText = await response.text();
          throw new Error(`Failed to fetch photos: ${response.status} - ${errorText}`);
        }
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
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhoto = async (photo: Photo) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('googleAccessToken');
      if (!token) {
        console.log('No access token found, redirecting to auth');
        handleAuth(true);
        return;
      }

      console.log(`Selecting photo ${photo.id} with token (first 10 chars):`, token.substring(0, 10) + '...');
      console.log('Photo base URL:', photo.baseUrl);

      // Use our backend proxy to fetch the image
      const proxyUrl = `${API_URL}/proxy/google-photos?url=${encodeURIComponent(photo.baseUrl)}&token=${encodeURIComponent(token)}`;
      console.log('Proxy URL (without token):', proxyUrl.split('&token=')[0]);

      const response = await fetch(proxyUrl);

      if (!response.ok) {
        console.error('Error response from proxy:', response.status, response.statusText);

        if (response.status === 401) {
          // Token is invalid or expired
          console.log('Token is invalid or expired, clearing and redirecting');
          localStorage.removeItem('googleAccessToken');
          setIsAuthenticated(false);

          // Force a new authentication
          setTimeout(() => {
            handleAuth(true);
          }, 500);
          return;
        }

        // Try to get more details about the error
        try {
          const errorText = await response.text();
          console.error('Error response details:', errorText);
          throw new Error(`Failed to fetch image: ${response.status} - ${errorText}`);
        } catch (textError) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
      }

      console.log('Successfully fetched image, converting to blob');
      const blob = await response.blob();
      console.log('Image blob created, size:', blob.size);

      onSelectImage(blob);
      handleClosePicker();
    } catch (err: any) {
      console.error('Error selecting photo:', err);
      setError(err.message || 'Failed to select photo');

      // If there's a serious error, offer to retry with a new authentication
      if (err.message && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('401')
      )) {
        setError(`${err.message}. Would you like to try signing in again?`);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle sign in
  const handleSignIn = () => {
    handleAuth(true); // Always force account selection
  };

  // Handle switch account with complete logout
  const handleSwitchAccount = () => {
    // First, clear all local storage related to Google auth
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    localStorage.removeItem('googleTokenExpiry');

    // Clear all Google-related cookies to force a complete logout
    document.cookie.split(";").forEach(function(c) {
      // Target all Google cookies
      if (c.trim().startsWith('GAPS=') ||
          c.trim().startsWith('LSID=') ||
          c.trim().startsWith('ACCOUNT_CHOOSER=') ||
          c.trim().startsWith('SMSV=') ||
          c.trim().startsWith('__Secure-1PSID=') ||
          c.trim().startsWith('__Secure-3PSID=') ||
          c.trim().startsWith('SID=') ||
          c.trim().startsWith('HSID=') ||
          c.trim().startsWith('SSID=') ||
          c.trim().startsWith('APISID=') ||
          c.trim().startsWith('SAPISID=') ||
          c.trim().startsWith('__Secure-1PAPISID=') ||
          c.trim().startsWith('__Secure-3PAPISID=') ||
          c.trim().startsWith('SIDCC=') ||
          c.trim().startsWith('__Secure-1PSIDCC=') ||
          c.trim().startsWith('__Secure-3PSIDCC=')) {
        const cookieName = c.trim().split('=')[0];
        // Clear the cookie from all possible domains and paths
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.google.com`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=accounts.google.com`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.accounts.google.com`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=photoslibrary.googleapis.com`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.googleapis.com`;
      }
    });

    // Set authenticated state to false to show the sign-in button
    setIsAuthenticated(false);
    setAlbums([]);
    setPhotos([]);

    // Force account selection on next sign-in
    setTimeout(() => {
      handleAuth(true);
    }, 500);
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
            onClick={handleSignIn}
            sx={{ mt: 1 }}
          >
            Sign in with Google
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', maxWidth: '300px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Currently signed in to Google Photos
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenPicker}
            fullWidth
            sx={{ minWidth: '220px' }}
          >
            Select from Google Photos
          </Button>

          <Divider sx={{ width: '100%', my: 1 }} />

          <Typography variant="body2" color="textSecondary" align="center">
            Want to use a different account?
          </Typography>

          <Button
            variant="outlined"
            color="error"
            onClick={handleSwitchAccount}
            startIcon={<span role="img" aria-label="switch">🔄</span>}
            fullWidth
            sx={{ minWidth: '220px', mt: 1 }}
          >
            Sign out & Switch Account
          </Button>
        </Box>
      )}

      <Dialog
        open={isOpen}
        onClose={handleClosePicker}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {viewMode === 'albums' ? 'Select an album from Google Photos' : 'Select a photo from the album'}
          </Typography>
          {viewMode === 'photos' && (
            <Button
              onClick={handleBackToAlbums}
              size="small"
              variant="outlined"
            >
              Back to Albums
            </Button>
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
          ) : viewMode === 'albums' ? (
            // Albums view
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {albums.length > 0 ? (
                <>
                  <Typography variant="subtitle1" sx={{ ml: 1 }}>
                    Your Albums ({albums.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {albums.map((album) => (
                      <Box key={album.id} sx={{ width: { xs: '100%', sm: '45%', md: '30%' } }}>
                        <Card
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 4
                            }
                          }}
                        >
                          <CardActionArea onClick={() => handleSelectAlbum(album.id)}>
                            <CardMedia
                              component="img"
                              height="140"
                              image={album.coverPhotoBaseUrl ?
                                `${album.coverPhotoBaseUrl}=w220-h140` :
                                'https://via.placeholder.com/220x140?text=No+Cover'
                              }
                              alt={album.title || 'Album'}
                              sx={{ objectFit: 'cover' }}
                            />
                            <Box sx={{ p: 1.5 }}>
                              <Typography variant="subtitle2" noWrap fontWeight="medium">
                                {album.title || 'Untitled Album'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {album.mediaItemsCount ? `${album.mediaItemsCount} items` : 'Unknown item count'}
                                {album.productUrl && (
                                  <Box component="span" sx={{ ml: 1 }}>
                                    • {album.isShared ? 'Shared' : 'Private'}
                                  </Box>
                                )}
                              </Typography>
                            </Box>
                          </CardActionArea>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                </>
              ) : (
                <Box sx={{ width: '100%', textAlign: 'center', py: 4, border: '1px dashed #ccc', borderRadius: 2 }}>
                  <Typography color="text.secondary" sx={{ mb: 1 }}>
                    No albums found in your Google Photos account
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Try creating albums in Google Photos first, or try signing in with a different account
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleSwitchAccount}
                    sx={{ mt: 2 }}
                  >
                    Switch Account
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            // Photos view
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {photos.length > 0 ? (
                <>
                  <Typography variant="subtitle1" sx={{ ml: 1 }}>
                    Photos in Album ({photos.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {photos.map((photo) => (
                      <Box key={photo.id} sx={{ width: { xs: '100%', sm: '30%', md: '22%', lg: '18%' } }}>
                        <Card
                          sx={{
                            height: '100%',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 4
                            }
                          }}
                        >
                          <CardActionArea onClick={() => handleSelectPhoto(photo)}>
                            <CardMedia
                              component="img"
                              height="120"
                              image={`${photo.baseUrl}=w220-h120`}
                              alt={photo.filename || 'Google Photo'}
                              sx={{ objectFit: 'cover' }}
                            />
                            {photo.filename && (
                              <Box sx={{ p: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {photo.filename}
                                </Typography>
                              </Box>
                            )}
                          </CardActionArea>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                </>
              ) : (
                <Box sx={{ width: '100%', textAlign: 'center', py: 4, border: '1px dashed #ccc', borderRadius: 2 }}>
                  <Typography color="text.secondary" sx={{ mb: 1 }}>
                    No photos found in this album
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Try selecting a different album or add photos to this album in Google Photos
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleBackToAlbums}
                    sx={{ mt: 2 }}
                  >
                    Back to Albums
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePicker} variant="outlined">Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DirectGooglePhotoPicker;
