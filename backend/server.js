// SightEd Backend Server
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const vision = require('@google-cloud/vision');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin and set up database
let db;
let dbType = 'firestore'; // Track which database implementation we're using

// Function to test if Firestore is working
async function testFirestore(firestoreDb) {
  try {
    // Try to write a test document
    const testDocRef = firestoreDb.collection('test').doc('test-doc-' + Date.now());
    await testDocRef.set({
      test: true,
      timestamp: new Date().toISOString()
    });

    // Try to read it back
    const docSnapshot = await testDocRef.get();
    return docSnapshot.exists;
  } catch (error) {
    console.error('Firestore test failed:', error.message);
    return false;
  }
}

// Initialize the database with fallbacks
async function initializeDatabase() {
  try {
    // Use the service account file directly
    const serviceAccount = require('./sighted-service-account.json');

    // Log the project ID for debugging
    console.log('Initializing Firebase with project ID:', serviceAccount.project_id);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      projectId: serviceAccount.project_id,
      storageBucket: `${serviceAccount.project_id}.appspot.com`
    });

    // Set the Firestore settings to use the nam5 region
    const firestoreSettings = {
      projectId: serviceAccount.project_id,
      databaseId: '(default)',
      preferRest: false,
      host: 'firestore.googleapis.com',
      ssl: true
    };

    // Initialize Firestore with explicit settings
    const firestoreDb = admin.firestore();

    // Apply the Firestore settings
    firestoreDb.settings(firestoreSettings);

    // Log Firestore settings for debugging
    console.log('Firestore settings:', firestoreDb._settings);
    console.log('Firestore initialized, testing connection...');

    // Test if Firestore is working
    const firestoreWorking = await testFirestore(firestoreDb);

    if (firestoreWorking) {
      console.log('Firestore connection test successful!');
      db = firestoreDb;
      dbType = 'firestore';
      return;
    }

    console.log('Firestore connection test failed, trying REST API client...');

    // Try REST API client
    try {
      const restClient = require('./firebase-rest-client');

      // Test if REST client is working
      const restDocRef = restClient.collection('test').doc('test-doc-' + Date.now());
      await restDocRef.set({
        test: true,
        timestamp: new Date().toISOString(),
        client: 'rest'
      });

      console.log('REST API client working successfully!');
      db = restClient;
      dbType = 'rest';
      return;
    } catch (restError) {
      console.error('REST API client failed:', restError.message);
    }

    // Fall back to mock database
    console.log('Using mock database as final fallback');
    db = require('./mock-db');
    dbType = 'mock';

  } catch (error) {
    console.error('Error initializing database:', error);
    console.log('Using mock database as fallback');
    db = require('./mock-db');
    dbType = 'mock';
  }
}

// Initialize database (this will be awaited before server starts)
const dbInitPromise = initializeDatabase();

// Initialize express app
const app = express();

// Configure CORS with specific options
app.use(cors({
  origin: '*', // Allow all origins temporarily to debug
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add a middleware to set CORS headers for all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Initialize Google Cloud Vision client
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: './sighted-service-account.json',
});

// Initialize Google Generative AI (Gemini) client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log("Gemini API Key:", process.env.GEMINI_API_KEY ? "Key is set" : "Key is missing");

// Configure multer with file size and type validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

app.use(express.json());

// Import axios for HTTP requests
const axios = require('axios');
const querystring = require('querystring');

// Import OAuth handlers
const googleOAuth = require('./google-oauth');

// Add a proxy endpoint for fetching Google Photos images
app.get('/proxy/google-photos', async (req, res) => {
  try {
    const { url, token } = req.query;

    if (!url || !token) {
      return res.status(400).json({ error: 'URL and token are required' });
    }

    console.log(`Proxying request to: ${url}`);
    console.log(`Token (first 10 chars): ${token.substring(0, 10)}...`);

    try {
      // Use the Google OAuth handler to fetch the image
      console.log('Using Google OAuth handler to fetch image...');

      const result = await googleOAuth.fetchMediaItem(token, url);

      // Set appropriate headers
      const contentType = result.contentType || 'image/jpeg';
      console.log('Setting Content-Type:', contentType);

      res.set('Content-Type', contentType);
      res.set('Content-Disposition', 'attachment; filename="google-photo.jpg"');
      res.set('Access-Control-Allow-Origin', '*');

      // Send the image data
      console.log('Sending image data to client...');
      res.send(result.data);
      console.log('Image data sent successfully!');
    } catch (apiError) {
      console.error('API Error:', apiError.message);

      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response headers:', apiError.response.headers);

        if (apiError.response.status === 401) {
          return res.status(401).json({
            error: 'Unauthorized: Token is invalid or expired',
            details: apiError.response.data
          });
        }
      }
      throw apiError;
    }
  } catch (error) {
    console.error('Error proxying Google Photos image:', error);

    // Provide more detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error data:', error.response.data);
      console.error('Response error status:', error.response.status);
      console.error('Response error headers:', error.response.headers);

      return res.status(error.response.status).json({
        error: `Failed to fetch image: ${error.response.status}`,
        details: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Request error:', error.request);
      return res.status(500).json({
        error: 'No response received from Google Photos API',
        details: 'The request was made but no response was received'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
      return res.status(500).json({
        error: 'Failed to proxy image',
        details: error.message
      });
    }
  }
});

// Add endpoint to fetch albums from Google Photos
app.get('/google-photos/albums', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('Fetching albums with token (first 10 chars):', token.substring(0, 10) + '...');

    try {
      const albums = await googleOAuth.fetchAlbums(token);
      console.log('Successfully fetched albums. Count:', albums.albums?.length || 0);
      res.json(albums);
    } catch (apiError) {
      console.error('API Error:', apiError);

      if (apiError.response) {
        if (apiError.response.status === 401) {
          return res.status(401).json({
            error: 'Unauthorized: Token is invalid or expired',
            details: apiError.response.data
          });
        }

        return res.status(apiError.response.status).json({
          error: `Failed to fetch albums: ${apiError.response.status}`,
          details: apiError.response.data
        });
      }

      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({
      error: 'Failed to fetch albums',
      details: error.message
    });
  }
});

// Add endpoint to fetch recent photos from Google Photos
app.get('/google-photos/recent', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('Fetching recent photos with token (first 10 chars):', token.substring(0, 10) + '...');

    try {
      const mediaItems = await googleOAuth.fetchMediaItems(token);
      console.log('Successfully fetched photos. Count:', mediaItems.mediaItems?.length || 0);
      res.json(mediaItems);
    } catch (apiError) {
      console.error('API Error:', apiError);

      if (apiError.response) {
        if (apiError.response.status === 401) {
          return res.status(401).json({
            error: 'Unauthorized: Token is invalid or expired',
            details: apiError.response.data
          });
        }

        return res.status(apiError.response.status).json({
          error: `Failed to fetch photos: ${apiError.response.status}`,
          details: apiError.response.data
        });
      }

      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({
      error: 'Failed to fetch photos',
      details: error.message
    });
  }
});

// Add endpoint to fetch photos from an album
app.post('/google-photos/media-items', async (req, res) => {
  try {
    const { token, albumId } = req.body;

    if (!token || !albumId) {
      return res.status(400).json({ error: 'Token and albumId are required' });
    }

    console.log(`Fetching photos from album ${albumId} with token (first 10 chars):`, token.substring(0, 10) + '...');

    try {
      const mediaItems = await googleOAuth.fetchMediaItems(token, albumId);
      console.log('Successfully fetched album photos. Count:', mediaItems.mediaItems?.length || 0);
      res.json(mediaItems);
    } catch (apiError) {
      console.error('API Error:', apiError);

      if (apiError.response) {
        if (apiError.response.status === 401) {
          return res.status(401).json({
            error: 'Unauthorized: Token is invalid or expired',
            details: apiError.response.data
          });
        }

        return res.status(apiError.response.status).json({
          error: `Failed to fetch album photos: ${apiError.response.status}`,
          details: apiError.response.data
        });
      }

      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching album photos:', error);
    res.status(500).json({
      error: 'Failed to fetch album photos',
      details: error.message
    });
  }
});

// Add Google OAuth routes
app.get('/auth/google', (req, res) => {
  const authUrl = googleOAuth.getAuthUrl();
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code is missing');
    }

    // Exchange the code for tokens
    const tokens = await googleOAuth.getTokens(code);

    // Redirect to the frontend with the tokens
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-callback?${querystring.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    })}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Simple Google OAuth flow for popup window
app.get('/auth/google-simple', (req, res) => {
  try {
    console.log('Starting Google OAuth flow with simple redirect...');
    console.log('Client ID:', googleOAuth.googleConfig.clientId);
    console.log('Redirect URL:', googleOAuth.googleConfig.simpleRedirectUrl);
    console.log('Scopes:', googleOAuth.googleConfig.scopes);

    // Clear any existing cookies to force account selection
    res.clearCookie('GAPS');
    res.clearCookie('LSID');
    res.clearCookie('ACCOUNT_CHOOSER');
    res.clearCookie('SMSV');

    // Get the auth URL with the simple redirect URL
    const authUrl = googleOAuth.getAuthUrl(googleOAuth.googleConfig.simpleRedirectUrl);
    console.log('Redirecting to Google OAuth URL:', authUrl);

    // Redirect to Google's OAuth page
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google OAuth flow:', error);
    console.error('Error details:', error.stack);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            color: #DB4437;
          }
          h1 {
            color: #DB4437;
          }
          .error-details {
            text-align: left;
            background-color: #f8f8f8;
            padding: 15px;
            border-radius: 4px;
            margin: 20px auto;
            max-width: 80%;
            overflow-wrap: break-word;
          }
          button {
            background-color: #4285F4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
          }
        </style>
        <script>
          function closeWindow() {
            window.close();
          }
          setTimeout(closeWindow, 10000);
        </script>
      </head>
      <body>
        <h1>Authentication Error</h1>
        <p>Failed to start Google authentication.</p>
        <div class="error-details">
          <p><strong>Error:</strong> ${error.message}</p>
        </div>
        <p>This window will close automatically in 10 seconds.</p>
        <button onclick="closeWindow()">Close Now</button>
      </body>
      </html>
    `);
  }
});

app.get('/auth/google-simple/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code is missing');
    }

    console.log('Received authorization code, exchanging for tokens...');

    // Exchange the code for tokens
    let tokens;
    try {
      tokens = await googleOAuth.getTokens(code);

      if (!tokens || !tokens.access_token) {
        console.error('No access token received from Google OAuth');
        throw new Error('No access token received from Google OAuth');
      }
    } catch (tokenError) {
      console.error('Error exchanging code for tokens:', tokenError);
      throw new Error(`Failed to exchange authorization code for tokens: ${tokenError.message}`);
    }

    console.log('Successfully obtained tokens');
    console.log('Access token length:', tokens.access_token ? tokens.access_token.length : 'none');
    console.log('Refresh token present:', tokens.refresh_token ? 'yes' : 'no');
    console.log('Expiry date present:', tokens.expiry_date ? 'yes' : 'no');

    // Return an HTML page that directly stores the token in localStorage
    console.log('Access token length:', tokens.access_token ? tokens.access_token.length : 'none');
    console.log('First 10 chars of token:', tokens.access_token ? tokens.access_token.substring(0, 10) + '...' : 'none');

    // Send an HTML page that will store the token and redirect
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Successful</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #4285F4;
          }
          .success {
            color: #0F9D58;
            font-size: 18px;
            margin: 20px 0;
          }
          .token-info {
            background-color: #f8f8f8;
            padding: 10px;
            border-radius: 4px;
            margin: 20px 0;
            text-align: left;
            word-break: break-all;
            font-family: monospace;
            font-size: 12px;
          }
          .buttons {
            margin-top: 30px;
          }
          button {
            background-color: #4285F4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 0 10px;
          }
          .debug-link {
            margin-top: 20px;
            font-size: 14px;
          }
          .debug-link a {
            color: #4285F4;
            text-decoration: none;
          }
          .debug-link a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Successful</h1>
          <p class="success">You have successfully signed in with Google Photos.</p>

          <div class="token-info">
            <strong>Access Token:</strong> ${tokens.access_token ? tokens.access_token.substring(0, 20) + '...' : 'None'}
            <br>
            <strong>Token Length:</strong> ${tokens.access_token ? tokens.access_token.length : 0} characters
          </div>

          <div class="buttons">
            <button id="continue">Continue to App</button>
            <button id="debug">Debug Mode</button>
          </div>

          <div class="debug-link">
            <a href="/oauth-debug.html#access_token=${encodeURIComponent(tokens.access_token)}">Advanced Debugging</a>
          </div>
        </div>

        <script>
          // Store the token in localStorage
          const token = "${tokens.access_token}";
          localStorage.setItem('googleAccessToken', token);
          console.log('Token stored in localStorage (length):', token.length);

          // Button event listeners
          document.getElementById('continue').addEventListener('click', function() {
            window.location.href = '/';
          });

          document.getElementById('debug').addEventListener('click', function() {
            window.location.href = '/oauth-debug.html#access_token=${encodeURIComponent(tokens.access_token)}';
          });

          // Auto-redirect after 5 seconds
          setTimeout(function() {
            window.location.href = '/';
          }, 5000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    console.error('Error details:', error.stack);

    // Store the error in localStorage and redirect to the debug page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #DB4437;
          }
          .error-message {
            color: #DB4437;
            font-size: 18px;
            margin: 20px 0;
          }
          .error-details {
            text-align: left;
            background-color: #f8f8f8;
            padding: 15px;
            border-radius: 4px;
            margin: 20px auto;
            word-break: break-all;
            font-family: monospace;
            font-size: 12px;
          }
          .buttons {
            margin-top: 30px;
          }
          button {
            background-color: #4285F4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 0 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Failed</h1>
          <p class="error-message">There was a problem authenticating with Google Photos.</p>

          <div class="error-details">
            <strong>Error:</strong> ${error.message}
          </div>

          <div class="buttons">
            <button id="try-again">Try Again</button>
            <button id="go-home">Go to Home Page</button>
            <button id="debug">Debug Mode</button>
          </div>
        </div>

        <script>
          // Store the error in localStorage
          localStorage.setItem('googleAuthError', 'Authentication failed: ${error.message.replace(/'/g, "\\'")}');
          console.error('Google OAuth Error:', '${error.message.replace(/'/g, "\\'")}');

          // Button event listeners
          document.getElementById('try-again').addEventListener('click', function() {
            // Clear any existing tokens
            localStorage.removeItem('googleAccessToken');
            localStorage.removeItem('googleRefreshToken');
            localStorage.removeItem('googleTokenExpiry');

            // Redirect to auth with timestamp to prevent caching
            const timestamp = new Date().getTime();
            window.location.href = '/auth/google-simple?t=' + timestamp;
          });

          document.getElementById('go-home').addEventListener('click', function() {
            window.location.href = '/';
          });

          document.getElementById('debug').addEventListener('click', function() {
            window.location.href = '/oauth-debug.html';
          });
        </script>
      </body>
      </html>
    `);
  }
});

// User registration endpoint
app.post('/api/users/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Email, password, firstName, and lastName are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        details: 'Please provide a valid email address'
      });
    }

    // Check if user already exists
    const userSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (!userSnapshot.empty) {
      return res.status(409).json({
        error: 'User already exists',
        details: 'A user with this email already exists'
      });
    }

    // In a production app, you would hash the password here
    // For simplicity, we're storing it as-is for now
    const hashedPassword = password; // Replace with proper hashing in production

    // Create user document
    const userRef = db.collection('users').doc();
    await userRef.set({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`User registered with ID: ${userRef.id}`);

    // Create a user object without the password
    const userResponse = {
      id: userRef.id,
      email,
      firstName,
      lastName
    };

    console.log('User registered successfully:', userResponse);

    // Return success response (without password)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      error: 'Failed to register user',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// User login endpoint
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Email and password are required'
      });
    }

    // Find user by email
    const userSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (userSnapshot.empty) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid email or password'
      });
    }

    // Get the first matching user
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // In a production app, you would compare hashed passwords
    // For simplicity, we're comparing as-is for now
    if (userData.password !== password) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid email or password'
      });
    }

    // Create a user object without the password
    const userResponse = {
      id: userDoc.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName
    };

    console.log('User logged in successfully:', userResponse);

    // Return success response (without password)
    res.json({
      success: true,
      message: 'Login successful',
      user: userResponse
    });

  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      error: 'Failed to log in',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// New Google Photos authentication start endpoint
app.get('/auth/google-photos/start', (req, res) => {
  try {
    // Get the origin for the redirect URI
    const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://sighted-82cad.web.app';
    const callbackUrl = `${req.protocol}://${req.get('host')}/auth/google-photos/callback`;

    console.log('Starting Google Photos auth flow');
    console.log('Origin:', origin);
    console.log('Callback URL:', callbackUrl);
    console.log('Protocol:', req.protocol);
    console.log('Host:', req.get('host'));
    console.log('Full URL:', req.originalUrl);

    // Check if we have the required Google OAuth configuration
    if (!googleOAuth || !googleOAuth.googleConfig) {
      console.error('Google OAuth configuration is missing');
      throw new Error('Google OAuth configuration is missing');
    }

    if (!googleOAuth.googleConfig.clientId) {
      console.error('Google OAuth client ID is missing');
      throw new Error('Google OAuth client ID is missing');
    }

    console.log('Creating OAuth client with:');
    console.log('Client ID:', googleOAuth.googleConfig.clientId);
    console.log('Client Secret:', googleOAuth.googleConfig.clientSecret ? 'Set (hidden)' : 'Not set');
    console.log('Callback URL:', callbackUrl);

    // Create a simplified OAuth client - use direct values instead of the module
    const oauth2Client = new google.auth.OAuth2(
      '438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com', // Client ID
      null, // No client secret for public clients
      callbackUrl
    );

    // Generate the auth URL with minimal parameters
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'online',
      scope: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
      prompt: 'select_account',
      include_granted_scopes: false
    });

    console.log('Generated auth URL:', authUrl);

    // Render a simple page that redirects to the auth URL
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Connecting to Google Photos</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #4285F4;
            margin-bottom: 20px;
          }
          p {
            margin-bottom: 25px;
            color: #555;
          }
          .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #4285F4;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Connecting to Google Photos</h1>
          <p>Please wait while we connect you to Google Photos...</p>
          <div class="loader"></div>
        </div>
        <script>
          // Redirect to Google auth after a short delay
          setTimeout(() => {
            window.location.href = "${authUrl}";
          }, 1000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error starting Google Photos auth:', error);
    res.status(500).json({ error: 'Failed to start authentication process' });
  }
});

// New Google Photos authentication callback endpoint
app.get('/auth/google-photos/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://sighted-82cad.web.app';

    if (!code) {
      return res.status(400).send('Authorization code is missing');
    }

    console.log('Received authorization code, exchanging for tokens...');

    // Create OAuth client with the same callback URL used in the auth request
    const callbackUrl = `${req.protocol}://${req.get('host')}/auth/google-photos/callback`;
    console.log('Callback URL for token exchange:', callbackUrl);

    // Use direct values instead of the module
    const oauth2Client = new google.auth.OAuth2(
      '438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com', // Client ID
      null, // No client secret for public clients
      callbackUrl
    );

    // Exchange the code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    console.log('Successfully obtained tokens');
    console.log('Access token length:', tokens.access_token ? tokens.access_token.length : 'none');
    console.log('Refresh token present:', tokens.refresh_token ? 'yes' : 'no');
    console.log('Expiry date present:', tokens.expiry_date ? 'yes' : 'no');

    // Store the token in a cookie and redirect back to the main app
    const frontendUrl = process.env.FRONTEND_URL || 'https://sighted-82cad.web.app';

    // Set the token in localStorage via a redirect script
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Successful</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #4285F4;
          }
          .success {
            color: #0F9D58;
            font-size: 18px;
            margin-bottom: 20px;
          }
          .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #4285F4;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Successful</h1>
          <p class="success">You have successfully signed in with Google Photos.</p>
          <p>Redirecting you back to the application...</p>
          <div class="loader"></div>
        </div>

        <script>
          // Store the token in localStorage
          localStorage.setItem('googleAccessToken', '${tokens.access_token}');
          console.log('Stored access token in localStorage');

          ${tokens.refresh_token ?
            `localStorage.setItem('googleRefreshToken', '${tokens.refresh_token}');
             console.log('Stored refresh token');`
            : 'console.log("No refresh token available");'}

          ${tokens.expiry_date ?
            `localStorage.setItem('googleTokenExpiry', '${tokens.expiry_date}');
             console.log('Stored token expiry');`
            : 'console.log("No expiry date available");'}

          // Redirect back to the main app
          setTimeout(function() {
            window.location.href = '${frontendUrl}';
          }, 1500);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);

    // Redirect back to the main app with an error
    const frontendUrl = process.env.FRONTEND_URL || 'https://sighted-82cad.web.app';

    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #DB4437;
          }
          .error-details {
            text-align: left;
            background-color: #f8f8f8;
            padding: 15px;
            border-radius: 4px;
            margin: 20px auto;
            max-width: 100%;
            overflow-wrap: break-word;
          }
          .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #DB4437;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Failed</h1>
          <p>There was a problem authenticating with Google Photos.</p>
          <div class="error-details">
            <p><strong>Error:</strong> ${error.message}</p>
          </div>
          <p>Redirecting you back to the application...</p>
          <div class="loader"></div>
        </div>

        <script>
          // Store the error in localStorage
          localStorage.setItem('googleAuthError', 'Authentication failed: ${error.message.replace(/'/g, "\\'")}');

          // Redirect back to the main app
          setTimeout(function() {
            window.location.href = '${frontendUrl}';
          }, 3000);
        </script>
      </body>
      </html>
    `);
  }
});

// Add endpoints for Google Photos API
app.get('/google-photos/albums', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    console.log('Fetching Google Photos albums with provided token');

    try {
      const albums = await googleOAuth.fetchAlbums(token);
      res.json(albums);
    } catch (apiError) {
      if (apiError.response && apiError.response.status === 401) {
        return res.status(401).json({
          error: 'Unauthorized: Token is invalid or expired',
          details: apiError.response.data
        });
      }
      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching Google Photos albums:', error);

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Failed to fetch albums: ${error.response.status}`,
        details: error.response.data
      });
    } else {
      return res.status(500).json({
        error: 'Failed to fetch albums',
        details: error.message
      });
    }
  }
});

// Endpoint to fetch recent photos
app.get('/google-photos/recent', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    console.log('Fetching recent Google Photos with provided token');

    try {
      // Make a direct request to the Google Photos API
      const response = await axios({
        method: 'GET',
        url: 'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      res.json(response.data);
    } catch (apiError) {
      if (apiError.response && apiError.response.status === 401) {
        return res.status(401).json({
          error: 'Unauthorized: Token is invalid or expired',
          details: apiError.response.data
        });
      }
      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching Google Photos:', error);

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Failed to fetch photos: ${error.response.status}`,
        details: error.response.data
      });
    } else {
      return res.status(500).json({
        error: 'Failed to fetch photos',
        details: error.message
      });
    }
  }
});

// Endpoint to fetch a specific photo by ID
app.get('/proxy/google-photo', async (req, res) => {
  try {
    const { id, token } = req.query;

    if (!id || !token) {
      return res.status(400).json({ error: 'Photo ID and token are required' });
    }

    console.log(`Fetching Google Photo with ID: ${id}`);

    try {
      // Make a direct request to the Google Photos API to get the media item
      const mediaItemResponse = await axios({
        method: 'GET',
        url: `https://photoslibrary.googleapis.com/v1/mediaItems/${id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const mediaItem = mediaItemResponse.data;

      if (!mediaItem || !mediaItem.baseUrl) {
        throw new Error('Invalid media item response');
      }

      // Now fetch the actual image
      const imageUrl = `${mediaItem.baseUrl}=w2048-h2048`;

      const imageResponse = await axios({
        method: 'GET',
        url: imageUrl,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'image/*'
        },
        responseType: 'arraybuffer'
      });

      // Set appropriate headers
      res.set('Content-Type', imageResponse.headers['content-type'] || 'image/jpeg');
      res.set('Content-Disposition', `attachment; filename="${mediaItem.filename || 'google-photo.jpg'}"`);
      res.set('Access-Control-Allow-Origin', '*');

      // Send the image data
      res.send(imageResponse.data);
    } catch (apiError) {
      if (apiError.response && apiError.response.status === 401) {
        return res.status(401).json({
          error: 'Unauthorized: Token is invalid or expired',
          details: apiError.response.data
        });
      }
      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching Google Photo:', error);

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Failed to fetch photo: ${error.response.status}`,
        details: error.response.data
      });
    } else {
      return res.status(500).json({
        error: 'Failed to fetch photo',
        details: error.message
      });
    }
  }
});



// Endpoint to proxy Google Photos image requests
app.get('/proxy/google-photos', async (req, res) => {
  try {
    const { url, token } = req.query;

    if (!url || !token) {
      return res.status(400).json({ error: 'URL and token are required' });
    }

    console.log(`Proxying Google Photos image request for URL: ${url}`);
    console.log('Token (first 10 chars):', token.substring(0, 10) + '...');

    try {
      // Add size parameter if not present
      const imageUrl = url.includes('=w') ? url : `${url}=w2048-h2048`;
      console.log('Full image URL:', imageUrl);

      // Fetch the image with retries
      let retries = 3;
      let imageResponse;

      while (retries > 0) {
        try {
          console.log(`Attempting to fetch image (${retries} retries left)...`);

          imageResponse = await axios({
            method: 'GET',
            url: imageUrl,
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'image/*'
            },
            responseType: 'arraybuffer',
            timeout: 10000 // 10 second timeout
          });

          console.log('Image fetch successful, size:', imageResponse.data.length);
          break; // Success, exit the retry loop
        } catch (retryError) {
          retries--;
          console.error(`Error fetching image (${retries} retries left):`, retryError.message);

          if (retryError.response && retryError.response.status === 401) {
            // Don't retry on auth errors
            throw retryError;
          }

          if (retries <= 0) {
            throw retryError;
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!imageResponse) {
        throw new Error('Failed to fetch image after multiple retries');
      }

      // Set appropriate headers
      res.set('Content-Type', imageResponse.headers['content-type'] || 'image/jpeg');
      res.set('Content-Disposition', 'attachment; filename="google-photo.jpg"');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

      // Send the image data
      res.send(imageResponse.data);
      console.log('Image sent to client successfully');
    } catch (apiError) {
      console.error('API error details:', apiError.message);

      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response headers:', apiError.response.headers);

        if (apiError.response.status === 401) {
          return res.status(401).json({
            error: 'Unauthorized: Token is invalid or expired',
            details: 'Your Google Photos authentication has expired. Please sign in again.'
          });
        }
      }
      throw apiError;
    }
  } catch (error) {
    console.error('Error proxying Google Photos image:', error);

    if (error.response) {
      let errorDetails = 'Unknown error';

      try {
        // Try to extract error details
        if (Buffer.isBuffer(error.response.data)) {
          // If it's a buffer, convert to string
          errorDetails = error.response.data.toString('utf8').substring(0, 200);
        } else if (typeof error.response.data === 'object') {
          errorDetails = JSON.stringify(error.response.data);
        } else {
          errorDetails = String(error.response.data);
        }
      } catch (e) {
        errorDetails = 'Could not parse error details';
      }

      return res.status(error.response.status).json({
        error: `Failed to fetch image: ${error.response.status}`,
        details: errorDetails
      });
    } else {
      return res.status(500).json({
        error: 'Failed to fetch image',
        details: error.message
      });
    }
  }
});

app.post('/google-photos/media-items', async (req, res) => {
  try {
    const { token, albumId } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    console.log(`Fetching Google Photos media items ${albumId ? 'from album ' + albumId : ''}`);

    try {
      const mediaItems = await googleOAuth.fetchMediaItems(token, albumId);
      res.json(mediaItems);
    } catch (apiError) {
      if (apiError.response && apiError.response.status === 401) {
        return res.status(401).json({
          error: 'Unauthorized: Token is invalid or expired',
          details: apiError.response.data
        });
      }
      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching Google Photos media items:', error);

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Failed to fetch media items: ${error.response.status}`,
        details: error.response.data
      });
    } else {
      return res.status(500).json({
        error: 'Failed to fetch media items',
        details: error.message
      });
    }
  }
});

// Root endpoint with API information
app.get('/', (req, res) => {
  // Check if the request is from a browser (looking for HTML)
  const acceptHeader = req.headers.accept || '';
  const wantsHtml = acceptHeader.includes('text/html');

  const apiInfo = {
    name: 'SightEd API',
    version: '1.0.0',
    description: 'API for SightEd - Educational Image Analysis Application',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      '/': 'API information (this response)',
      '/health': 'Health check endpoint',
      '/api/analyze': 'Analyze an image',
      '/api/images': 'Get all analyzed images',
      '/api/images/:id': 'Get a specific analyzed image',
      '/api/saved': 'Get saved analysis results',
      '/test-firestore': 'Test Firestore connection'
    },
    frontend: process.env.FRONTEND_URL || 'https://sighted-82cad.web.app',
    documentation: 'https://github.com/yourusername/SightEd'
  };

  if (wantsHtml) {
    // Return HTML for browsers
    const endpointsList = Object.entries(apiInfo.endpoints)
      .map(([path, desc]) => `<li><code>${path}</code> - ${desc}</li>`)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${apiInfo.name} - ${apiInfo.version}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #be5683;
            border-bottom: 2px solid #be5683;
            padding-bottom: 10px;
          }
          h2 {
            color: #be5683;
            margin-top: 30px;
          }
          .status {
            display: inline-block;
            background-color: #4caf50;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-weight: bold;
          }
          code {
            background-color: #f5f5f5;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
          }
          ul {
            background-color: #f9f9f9;
            padding: 20px 20px 20px 40px;
            border-radius: 5px;
          }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #eee;
            padding-top: 20px;
            font-size: 0.9em;
            color: #666;
          }
          a {
            color: #be5683;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .button {
            display: inline-block;
            background-color: #be5683;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
            margin-top: 20px;
            font-weight: bold;
          }
          .button:hover {
            background-color: #a73d69;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <h1>${apiInfo.name}</h1>
        <p>${apiInfo.description}</p>
        <p>Version: <strong>${apiInfo.version}</strong> | Status: <span class="status">${apiInfo.status}</span></p>
        <p>Last updated: ${new Date(apiInfo.timestamp).toLocaleString()}</p>

        <h2>Available Endpoints</h2>
        <ul>
          ${endpointsList}
        </ul>

        <h2>Links</h2>
        <p>
          <a href="${apiInfo.frontend}" class="button">Go to SightEd Application</a>
        </p>

        <div class="footer">
          <p>SightEd API Server | Running on Google Cloud Run</p>
          <p>For more information, visit <a href="${apiInfo.documentation}">${apiInfo.documentation}</a></p>
        </div>
      </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } else {
    // Return JSON for API clients
    res.json(apiInfo);
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Simple test route to create a document directly
app.get('/test-create-document', async (req, res) => {
  try {
    console.log('Attempting to create a test document directly...');
    console.log(`Using database type: ${dbType}`);

    // Create a simple test document
    const testData = {
      title: 'Test Document',
      description: 'Created for testing purposes',
      timestamp: new Date().toISOString(),
      dbType: dbType
    };

    // Try to create the document with a specific ID
    const docId = `test-direct-${Date.now()}`;
    const docRef = db.collection('test-documents').doc(docId);

    console.log(`Creating document with ID: ${docId} in collection: test-documents`);
    await docRef.set(testData);

    console.log('Document created successfully!');

    // Try to read it back
    const docSnapshot = await docRef.get();

    if (docSnapshot.exists) {
      console.log('Successfully read document back');
      res.json({
        success: true,
        message: 'Test document created and read successfully',
        documentId: docId,
        documentData: docSnapshot.data(),
        dbType: dbType
      });
    } else {
      console.log('Document was created but cannot be read back');
      res.json({
        success: false,
        message: 'Document was created but cannot be read back',
        documentId: docId,
        dbType: dbType
      });
    }
  } catch (error) {
    console.error('Error creating test document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test document',
      details: error.message,
      stack: error.stack,
      dbType: dbType
    });
  }
});

// Get image data by ID
app.get('/image/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Image ID is required' });
  }

  try {
    // First check if we have this image in our in-memory cache for faster retrieval
    if (global.imageCache && global.imageCache[id]) {
      console.log(`Retrieved image data from cache for ID: ${id}`);
      return res.json(global.imageCache[id]);
    }

    // If not in cache, try to fetch from Firestore
    console.log(`Fetching image data from Firestore for ID: ${id}`);
    const imageDoc = await db.collection('images').doc(id).get();

    if (!imageDoc.exists) {
      console.log(`Image with ID ${id} not found in Firestore`);
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageData = imageDoc.data();

    // Store in cache for future requests
    if (!global.imageCache) {
      global.imageCache = {};
    }
    global.imageCache[id] = imageData;

    console.log(`Retrieved image data from Firestore for ID: ${id}`);
    res.json(imageData);
  } catch (error) {
    console.error(`Error retrieving image data for ID ${id}:`, error);
    res.status(500).json({
      error: 'Error retrieving image data',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Upload route with enhanced error handling
app.post('/upload', (req, res, next) => {
  console.log('Upload request received');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);
  console.log('Origin:', req.headers['origin']);

  // Set CORS headers explicitly for this route
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Use the multer middleware with custom error handling
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      // Set CORS headers again for error responses
      res.header('Access-Control-Allow-Origin', '*');
      return res.status(400).json({
        error: 'Error processing image upload',
        details: err.message
      });
    }

    // Continue to the next middleware if no error
    next();
  });
}, async (req, res) => {
  // Set CORS headers again for the actual response
  res.header('Access-Control-Allow-Origin', '*');
  try {
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('Processing image:', req.file.originalname);
    console.log('File details:', {
      fieldname: req.file.fieldname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer ? `${req.file.buffer.length} bytes` : 'No buffer'
    });

    let labelResult, landmarkResult;

    try {
      [labelResult] = await visionClient.labelDetection({
        image: { content: req.file.buffer },
      });

      [landmarkResult] = await visionClient.landmarkDetection({
        image: { content: req.file.buffer },
      });
    } catch (apiError) {
      console.error('Error calling Vision API:', apiError);

      // Check if this is a quota exceeded error
      if (apiError.message && apiError.message.includes('quota')) {
        return res.status(429).json({
          error: 'The quota has been exceeded',
          message: 'Daily limit for image analysis has been reached. Please try again tomorrow.',
          details: 'QUOTA_EXCEEDED'
        });
      }

      // Re-throw for general error handling
      throw apiError;
    }

    const labels = labelResult.labelAnnotations ? labelResult.labelAnnotations.map(label => ({
      description: label.description,
      score: label.score,
    })) : [];

    const landmarks = landmarkResult.landmarkAnnotations ? landmarkResult.landmarkAnnotations.map(landmark => ({
      description: landmark.description,
      score: landmark.score,
      locations: landmark.locations,
    })) : [];

    // Generate comprehensive analysis using Gemini
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Create a prompt for Gemini to generate a detailed analysis
    const analysisPrompt = `
      Generate a comprehensive analysis of an image based on the following detected elements:

      Labels detected: ${labels.map(l => l.description).join(', ')}

      ${landmarks.length > 0 ? `Landmarks detected: ${landmarks.map(l => l.description).join(', ')}` : ''}

      Please provide the following sections:

      1. SCENE DESCRIPTION: A comprehensive, educational description in 2-3 sentences that explains what's in the image.
      Focus on the main elements and their relationships. Be specific and informative.

      2. SCIENTIFIC FACTS: Provide exactly 3 interesting scientific facts related to the main elements in the image.
      These should be educational and help the user learn something new.

      3. QUICK QUIZ: Create 3 simple multiple-choice questions about the content in the image.
      Each question should have 4 options (A, B, C, D) with one correct answer and a detailed explanation.

      Format your response as a JSON object with the following structure:
      {
        "sceneDescription": "Your detailed scene description here...",
        "scientificFacts": ["Fact 1", "Fact 2", "Fact 3", ...],
        "quickQuiz": [
          {
            "question": "Question 1?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0,
            "explanation": "A detailed explanation of why this answer is correct and educational information about the topic."
          },
          ...more questions...
        ]
      }
    `;

    let aiDescription, scientificFacts = [], quickQuiz = [];

    try {
      console.log('Calling Gemini API for image analysis...');
      const analysisResult = await geminiModel.generateContent(analysisPrompt);
      const analysisResponse = await analysisResult.response;
      const analysisText = analysisResponse.text().trim();
      console.log('Generated analysis:', analysisText);

      // Extract the JSON from the response
      try {
        // Find JSON in the response (it might be wrapped in markdown code blocks)
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        let analysisData;

        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not extract JSON from response');
        }

        // Extract the components
        aiDescription = analysisData.sceneDescription || '';
        scientificFacts = analysisData.scientificFacts || [];
        quickQuiz = analysisData.quickQuiz || [];

        console.log('Extracted scene description:', aiDescription);
        console.log('Extracted scientific facts:', scientificFacts);
        console.log('Extracted quick quiz:', quickQuiz);
      } catch (parseError) {
        console.error('Error parsing analysis JSON:', parseError);
        // If JSON parsing fails, try to extract sections manually
        const descMatch = analysisText.match(/SCENE DESCRIPTION:[\s\S]*?(?=SCIENTIFIC FACTS:|$)/i);
        const factsMatch = analysisText.match(/SCIENTIFIC FACTS:[\s\S]*?(?=QUICK QUIZ:|$)/i);

        if (descMatch) {
          aiDescription = descMatch[0].replace(/SCENE DESCRIPTION:/i, '').trim();
        }

        // Fallback for scientific facts and quiz
        scientificFacts = [];
        quickQuiz = [];
      }
    } catch (analysisError) {
      console.error('Error generating analysis:', analysisError);

      // Check if this is a quota exceeded error
      if (analysisError.message && analysisError.message.includes('quota')) {
        return res.status(429).json({
          error: 'The quota has been exceeded',
          message: 'Daily limit for AI analysis has been reached. Please try again tomorrow.',
          details: 'QUOTA_EXCEEDED'
        });
      }

      // Fallback to simple description if Gemini fails
      aiDescription = labels
        .slice(0, 5)
        .map(label => label.description)
        .join(', ');
    }

    const imageDoc = {
      labels,
      landmarks,
      aiDescription,
      scientificFacts,
      quickQuiz,
      createdAt: new Date().toISOString(),
      fileName: req.file.originalname,
    };

    // Generate an ID
    const imageId = 'img-' + Date.now();

    // Store in both Firestore and in-memory cache
    try {
      console.log(`Storing image data in Firestore with ID: ${imageId}`);

      // Create a sanitized version of the document for Firestore
      // Remove any large binary data or problematic fields
      const firestoreDoc = {
        id: imageId,
        title: imageDoc.title || 'Untitled Image',
        aiDescription: imageDoc.aiDescription,
        scientificFacts: imageDoc.scientificFacts || [],
        quickQuiz: imageDoc.quickQuiz || [],
        labels: imageDoc.labels || [],
        landmarks: imageDoc.landmarks || [],
        createdAt: new Date().toISOString(),
        // Don't store the actual image data in Firestore
        // Instead, store a reference or URL if available
        imageUrl: imageDoc.imageUrl ? true : false, // Just store a boolean flag
        fileName: imageDoc.fileName || 'unknown.jpg'
      };

      await db.collection('images').doc(imageId).set(firestoreDoc);
      console.log(`Successfully stored image data in Firestore with ID: ${imageId}`);

      // Also store in our in-memory cache for faster retrieval (including full data)
      if (!global.imageCache) {
        global.imageCache = {};
      }
      global.imageCache[imageId] = imageDoc;

      console.log(`Stored image data in cache with ID: ${imageId}`);
    } catch (dbError) {
      console.error(`Error storing image data in Firestore:`, dbError);
      // Continue even if Firestore storage fails, using only the cache
      console.log(`Falling back to cache-only storage for ID: ${imageId}`);
      if (!global.imageCache) {
        global.imageCache = {};
      }
      global.imageCache[imageId] = imageDoc;
    }

    res.json({
      id: imageId,
      ...imageDoc,
      message: 'Image analysis saved successfully'
    });

  } catch (error) {
    console.error('Error processing image:', error);
    console.error('Error stack:', error.stack);

    // Determine the appropriate status code
    let statusCode = 500;
    if (error.status) {
      statusCode = error.status;
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413; // Payload Too Large
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      statusCode = 400; // Bad Request
    }

    // Set CORS headers again for error responses
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Send a detailed error response
    res.status(statusCode).json({
      error: 'Error processing image',
      message: error.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        code: error.code,
        name: error.name
      } : 'Internal server error'
    });
  }
});

// Get saved images route with pagination
app.get('/saved', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    console.log(`Fetching saved images with pagination: page=${page}, limit=${limit}`);

    // Query Firestore for saved images
    let imagesQuery = db.collection('images')
      .orderBy('createdAt', 'desc');

    // Get total count (for pagination)
    const totalSnapshot = await imagesQuery.get();
    const total = totalSnapshot.size;

    // Apply pagination
    imagesQuery = imagesQuery.limit(limit).offset(skip);

    // Execute the query
    const snapshot = await imagesQuery.get();

    if (snapshot.empty) {
      console.log('No saved images found');
      return res.json({
        images: [],
        page,
        limit,
        total: 0
      });
    }

    // Process the results
    const images = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      images.push({
        id: doc.id,
        ...data
      });
    });

    console.log(`Retrieved ${images.length} images from Firestore`);

    res.json({
      images,
      page,
      limit,
      total
    });
  } catch (error) {
    console.error('Error fetching saved images:', error);
    res.status(500).json({
      error: 'Error fetching saved images',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Generate quiz based on image analysis
app.post('/generate-quiz', async (req, res) => {
  try {
    const { imageId } = req.body;

    if (!imageId) {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    // Try to retrieve the image data from cache first, then Firestore if not found
    let imageData;

    // Check if we have this image in our in-memory cache
    if (global.imageCache && global.imageCache[imageId]) {
      console.log(`Retrieved image data from cache for ID: ${imageId}`);
      imageData = global.imageCache[imageId];
    } else {
      // If not in cache, try to fetch from Firestore
      try {
        console.log(`Fetching image data from Firestore for ID: ${imageId}`);
        const imageDoc = await db.collection('images').doc(imageId).get();

        if (!imageDoc.exists) {
          console.log(`Image with ID ${imageId} not found in Firestore`);
          return res.status(404).json({ error: 'Image data not found. Please upload the image again.' });
        }

        imageData = imageDoc.data();

        // Store in cache for future requests
        if (!global.imageCache) {
          global.imageCache = {};
        }
        global.imageCache[imageId] = imageData;

        console.log(`Retrieved image data from Firestore for ID: ${imageId}`);
      } catch (error) {
        console.error(`Error retrieving image data from Firestore for ID ${imageId}:`, error);
        return res.status(500).json({
          error: 'Error retrieving image data',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
    }

    console.log(`Using image data for ID: ${imageId}`);

    const { labels, landmarks, aiDescription } = imageData;

    // Create a prompt for Gemini to generate quiz questions
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      Generate an educational quiz with 5 multiple-choice questions based on the following image analysis:

      Description: ${aiDescription}

      Labels detected: ${labels.map(l => l.description).join(', ')}

      ${landmarks.length > 0 ? `Landmarks detected: ${landmarks.map(l => l.description).join(', ')}` : ''}

      For each question:
      1. Create an educational question that teaches the user something about the content in the image
      2. Focus on facts, concepts, and knowledge related to what's shown in the image
      3. Provide 4 possible answers (A, B, C, D)
      4. Indicate the correct answer
      5. Add a detailed explanation for why the answer is correct and include educational information

      Make the questions varied in difficulty and topic. They should be informative and help the user learn about what's in the image.

      Format the response as a JSON array with the following structure:
      [
        {
          "question": "Question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0, // Index of the correct answer (0-3)
          "explanation": "Explanation text"
        },
        // more questions...
      ]
    `;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract the JSON from the response
    let quizQuestions;
    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
      if (jsonMatch) {
        quizQuestions = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON array is found, try to parse the entire response
        quizQuestions = JSON.parse(text);
      }

      // For testing purposes, skip storing in Firestore
      console.log('Quiz generated successfully, skipping Firestore storage for testing');

      res.json({
        quiz: quizQuestions,
        imageId
      });
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      res.status(500).json({
        error: 'Failed to generate quiz questions',
        details: process.env.NODE_ENV === 'development' ? parseError.message : 'Error processing response'
      });
    }
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({
      error: 'Failed to generate quiz',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Generate explanation for a quiz question
app.post('/generate-explanation', async (req, res) => {
  try {
    const { imageId, question, options, correctAnswer } = req.body;

    if (!imageId || !question || !options || correctAnswer === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Try to retrieve the image data from cache first, then Firestore if not found
    let imageData;

    // Check if we have this image in our in-memory cache
    if (global.imageCache && global.imageCache[imageId]) {
      console.log(`Retrieved image data from cache for ID: ${imageId}`);
      imageData = global.imageCache[imageId];
    } else {
      // If not in cache, try to fetch from Firestore
      try {
        console.log(`Fetching image data from Firestore for ID: ${imageId}`);
        const imageDoc = await db.collection('images').doc(imageId).get();

        if (!imageDoc.exists) {
          console.log(`Image with ID ${imageId} not found in Firestore`);
          return res.status(404).json({ error: 'Image data not found' });
        }

        imageData = imageDoc.data();

        // Store in cache for future requests
        if (!global.imageCache) {
          global.imageCache = {};
        }
        global.imageCache[imageId] = imageData;

        console.log(`Retrieved image data from Firestore for ID: ${imageId}`);
      } catch (error) {
        console.error(`Error retrieving image data from Firestore for ID ${imageId}:`, error);
        return res.status(500).json({
          error: 'Error retrieving image data',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
    }

    const { labels, landmarks, aiDescription } = imageData;
    const correctOption = options[correctAnswer];

    // Create a prompt for Gemini to generate an explanation
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      Generate an accurate, educational explanation for why the following answer is correct.

      Image description: ${aiDescription}

      Labels detected in the image: ${labels.map(l => l.description).join(', ')}

      ${landmarks.length > 0 ? `Landmarks in the image: ${landmarks.map(l => l.description).join(', ')}` : ''}

      Question: ${question}

      Options:
      ${options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n')}

      Correct answer: ${String.fromCharCode(65 + correctAnswer)}. ${correctOption}

      Please provide a detailed, factually accurate explanation of why this answer is correct. Include educational information that helps the user understand the concept better. Keep your explanation concise (2-3 sentences) but informative.
    `;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text().trim();

    res.json({
      explanation
    });
  } catch (error) {
    console.error('Error generating explanation:', error);
    res.status(500).json({
      error: 'Failed to generate explanation',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Test endpoint to verify Firestore connection and create collections
app.get('/test-firestore', async (req, res) => {
  try {
    // Create a very simple test document
    const testData = {
      test: true,
      message: 'This is a test document',
      timestamp: new Date().toISOString()
    };

    console.log('Attempting to write test document to Firestore...');

    // Create collections and documents
    const collections = [
      'test-collection',
      'images',
      'users',
      'saved'
    ];

    const results = {};

    // Create a document in each collection
    for (const collectionName of collections) {
      try {
        const docId = `test-${collectionName}-${Date.now()}`;

        // Add collection name to test data
        const collectionData = {
          ...testData,
          collection: collectionName
        };

        // Try to create the document
        await db.collection(collectionName).doc(docId).set(collectionData);
        console.log(`Document created in ${collectionName} with ID: ${docId}`);

        // Try to read the document back
        const docSnapshot = await db.collection(collectionName).doc(docId).get();

        if (docSnapshot.exists) {
          console.log(`Successfully read document back from ${collectionName}`);
          results[collectionName] = {
            success: true,
            documentId: docId,
            exists: true
          };
        } else {
          results[collectionName] = {
            success: false,
            documentId: docId,
            exists: false,
            error: 'Document was written but cannot be read back'
          };
        }
      } catch (collectionError) {
        console.error(`Error with ${collectionName} collection:`, collectionError);
        results[collectionName] = {
          success: false,
          error: collectionError.message
        };
      }
    }

    // List all collections
    try {
      const allCollections = await db.listCollections();
      const collectionNames = allCollections.map(col => col.id);
      console.log('All collections:', collectionNames);

      res.json({
        success: true,
        message: 'Firestore connection test completed',
        results: results,
        allCollections: collectionNames
      });
    } catch (listError) {
      console.error('Error listing collections:', listError);
      res.json({
        success: true,
        message: 'Firestore document operations completed with some results',
        results: results,
        listCollectionsError: listError.message
      });
    }
  } catch (error) {
    console.error('Error testing Firestore connection:', error);
    res.status(500).json({
      success: false,
      error: 'Firestore connection failed',
      details: error.message
    });
  }
});

// Endpoint to list all images in the database
app.get('/api/images', async (req, res) => {
  try {
    console.log('Fetching all images from Firestore...');
    const snapshot = await db.collection('images').get();

    if (snapshot.empty) {
      console.log('No images found in Firestore');
      return res.json({
        images: [],
        message: 'No images found in the database'
      });
    }

    const images = [];
    snapshot.forEach(doc => {
      images.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Found ${images.length} images in Firestore`);
    res.json({
      images,
      count: images.length
    });
  } catch (error) {
    console.error('Error fetching images from Firestore:', error);
    res.status(500).json({
      error: 'Failed to fetch images',
      details: error.message
    });
  }
});

// Endpoint to get a specific image by ID
app.get('/api/images/:id', async (req, res) => {
  try {
    const imageId = req.params.id;
    console.log(`Fetching image with ID: ${imageId} from database...`);

    const docSnapshot = await db.collection('images').doc(imageId).get();

    if (!docSnapshot.exists) {
      console.log(`Image with ID ${imageId} not found`);
      return res.status(404).json({
        error: 'Image not found',
        imageId
      });
    }

    const imageData = docSnapshot.data();
    console.log(`Found image with ID: ${imageId}`);

    res.json({
      id: imageId,
      ...imageData
    });
  } catch (error) {
    console.error(`Error fetching image with ID ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to fetch image',
      details: error.message
    });
  }
});

// Test endpoints for database verification
app.post('/api/add-test-endpoints', (req, res) => {
  // Simple security check
  if (req.body.secret !== 'test-mode-activate') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  console.log('Adding test endpoints for database verification');

  // Add test document endpoint
  app.post('/api/test-document', async (req, res) => {
    try {
      console.log('Creating test document with data:', req.body);
      const docRef = db.collection('test-documents').doc();
      await docRef.set({
        ...req.body,
        createdAt: new Date().toISOString()
      });

      const docSnapshot = await docRef.get();

      res.json({
        id: docRef.id,
        ...docSnapshot.data()
      });
    } catch (error) {
      console.error('Error creating test document:', error);
      res.status(500).json({
        error: 'Failed to create test document',
        details: error.message
      });
    }
  });

  // Get test document endpoint
  app.get('/api/test-document/:id', async (req, res) => {
    try {
      const docId = req.params.id;
      console.log(`Fetching test document with ID: ${docId}`);

      const docSnapshot = await db.collection('test-documents').doc(docId).get();

      if (!docSnapshot.exists) {
        return res.status(404).json({
          error: 'Test document not found',
          id: docId
        });
      }

      res.json({
        id: docId,
        ...docSnapshot.data()
      });
    } catch (error) {
      console.error(`Error fetching test document with ID ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to fetch test document',
        details: error.message
      });
    }
  });

  res.json({ success: true, message: 'Test endpoints added successfully' });
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Name, email, subject, and message are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        details: 'Please provide a valid email address'
      });
    }

    console.log(`Received contact form submission from ${name} (${email})`);

    // Create a document in Firestore
    const contactRef = db.collection('contact-submissions').doc();
    await contactRef.set({
      name,
      email,
      subject,
      message,
      createdAt: new Date().toISOString(),
      read: false
    });

    console.log(`Contact form submission saved with ID: ${contactRef.id}`);

    res.status(201).json({
      success: true,
      message: 'Contact form submission received successfully',
      id: contactRef.id
    });

  } catch (error) {
    console.error('Error processing contact form submission:', error);
    res.status(500).json({
      error: 'Failed to process contact form submission',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Endpoint to get all contact form submissions (admin only)
app.get('/api/contact', async (req, res) => {
  try {
    // In a production app, you would add authentication here
    // to ensure only admins can access this endpoint

    const submissionsSnapshot = await db.collection('contact-submissions')
      .orderBy('createdAt', 'desc')
      .get();

    const submissions = [];
    submissionsSnapshot.forEach(doc => {
      submissions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      submissions
    });

  } catch (error) {
    console.error('Error fetching contact form submissions:', error);
    res.status(500).json({
      error: 'Failed to fetch contact form submissions',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Endpoint to check database status
app.get('/api/db-status', (req, res) => {
  res.json({
    dbType: dbType,
    isFirestore: dbType === 'firestore',
    isMock: dbType === 'mock',
    isRest: dbType === 'rest',
    collections: Object.keys(db.collections || {})
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error caught by middleware:', err.stack);

  // Send error response
  res.status(500).json({
    error: 'Something broke!',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });

  // Call next() if you want to continue to other middleware (usually not needed for error handlers)
  // next();
});

const PORT = process.env.PORT || 5001;

// Wait for database initialization before starting the server
dbInitPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with ${dbType} database`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  console.log('Starting server with mock database...');

  // Ensure we have a database, even if it's just the mock
  if (!db) {
    db = require('./mock-db');
    dbType = 'mock';
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with ${dbType} database (after error recovery)`);
  });
});

module.exports = app;
