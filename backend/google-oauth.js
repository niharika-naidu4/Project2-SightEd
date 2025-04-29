const axios = require('axios');
const { google } = require('googleapis');
const querystring = require('querystring');

// Google OAuth configuration
const googleConfig = {
  clientId: '438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', // You'll need to set this environment variable
  // Use the registered redirect URIs from Google Cloud Console
  redirectUrl: process.env.REDIRECT_URI || 'https://sighted-82cad.web.app/oauth-callback',
  simpleRedirectUrl: process.env.SIMPLE_REDIRECT_URI || 'https://sighted-82cad.web.app/oauth-callback',
  scopes: [
    'https://www.googleapis.com/auth/photoslibrary.readonly'
  ]
};

// Log OAuth configuration for debugging
console.log('Google OAuth Configuration:');
console.log('Client ID:', googleConfig.clientId);
console.log('Client Secret:', googleConfig.clientSecret ? 'Set (hidden)' : 'Not set');
console.log('Redirect URL:', googleConfig.redirectUrl);
console.log('Simple Redirect URL:', googleConfig.simpleRedirectUrl);
console.log('Scopes:', googleConfig.scopes);

// Create an OAuth2 client
const createOAuth2Client = (redirectUrl = googleConfig.redirectUrl) => {
  // For web applications, we need to provide the client secret
  return new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret || null,
    redirectUrl
  );
};

// Generate the authorization URL
const getAuthUrl = (redirectUrl) => {
  console.log('Generating auth URL with redirect URL:', redirectUrl || googleConfig.redirectUrl);
  const oauth2Client = createOAuth2Client(redirectUrl);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: googleConfig.scopes,
    prompt: 'consent select_account',  // Force consent and account selection
    include_granted_scopes: true,
  });
};

// Exchange the authorization code for tokens
const getTokens = async (code) => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

// Refresh the access token if it's expired
const refreshAccessToken = async (refreshToken) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
};

// Fetch albums from Google Photos
const fetchAlbums = async (accessToken) => {
  try {
    const response = await axios({
      method: 'GET',
      url: 'https://photoslibrary.googleapis.com/v1/albums',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching albums:', error);
    throw error;
  }
};

// Fetch media items from an album
const fetchMediaItems = async (accessToken, albumId) => {
  try {
    let url = 'https://photoslibrary.googleapis.com/v1/mediaItems';
    let data = {};
    let method = 'GET';

    if (albumId) {
      url = 'https://photoslibrary.googleapis.com/v1/mediaItems:search';
      data = { albumId, pageSize: 100 };
      method = 'POST';
    } else {
      url += '?pageSize=100';
    }

    const response = await axios({
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: method === 'POST' ? data : undefined
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching media items:', error);
    throw error;
  }
};

// Fetch a media item (image)
const fetchMediaItem = async (accessToken, baseUrl) => {
  try {
    console.log('Fetching media item with token:', accessToken.substring(0, 10) + '...');
    console.log('Base URL:', baseUrl);

    const imageUrl = `${baseUrl}=w2048-h2048`;
    console.log('Full image URL:', imageUrl);

    // Make a direct request to the Google Photos API
    try {
      console.log('Making request to Google Photos API...');

      const response = await axios({
        method: 'GET',
        url: imageUrl,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'image/*'
        },
        responseType: 'arraybuffer'
      });

      console.log('Response received from Google Photos API');
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data length:', response.data.length);

      return {
        data: response.data,
        contentType: response.headers['content-type'] || 'image/jpeg'
      };
    } catch (requestError) {
      console.error('Request error details:', requestError.message);

      if (requestError.response) {
        console.error('Response status:', requestError.response.status);
        console.error('Response headers:', requestError.response.headers);

        // If we have a response body and it's not binary data, log it
        if (requestError.response.data && !Buffer.isBuffer(requestError.response.data)) {
          console.error('Response data:', requestError.response.data);
        }
      }

      throw requestError;
    }
  } catch (error) {
    console.error('Error fetching media item:', error.message);
    throw error;
  }
};

module.exports = {
  googleConfig,
  getAuthUrl,
  getTokens,
  refreshAccessToken,
  fetchAlbums,
  fetchMediaItems,
  fetchMediaItem
};
