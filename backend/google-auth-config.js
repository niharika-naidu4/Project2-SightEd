// Google OAuth configuration
module.exports = {
  CLIENT_ID: '438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com',
  API_KEY: process.env.GOOGLE_API_KEY || '',
  SCOPES: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
  DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/photoslibrary/v1/rest']
};
