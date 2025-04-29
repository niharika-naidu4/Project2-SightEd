const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const serviceAccount = require('./sighted-service-account.json');

async function testDirectFirestore() {
  try {
    console.log('Testing direct Firestore API access...');
    console.log('Project ID:', serviceAccount.project_id);
    
    // Get auth token
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/datastore']
    });
    
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;
    
    console.log('Successfully obtained auth token');
    
    // List databases
    const listDatabasesUrl = `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases`;
    
    console.log('Listing databases at URL:', listDatabasesUrl);
    
    const databasesResponse = await axios.get(listDatabasesUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Databases:', JSON.stringify(databasesResponse.data, null, 2));
    
    // Try to list collections
    const listCollectionsUrl = `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents`;
    
    console.log('Listing collections at URL:', listCollectionsUrl);
    
    const collectionsResponse = await axios.get(listCollectionsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Collections response:', JSON.stringify(collectionsResponse.data, null, 2));
    
    // Try to create a document
    const createDocUrl = `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/test-direct`;
    
    console.log('Creating document at URL:', createDocUrl);
    
    const docData = {
      fields: {
        title: { stringValue: 'Test Direct API' },
        timestamp: { stringValue: new Date().toISOString() }
      }
    };
    
    const createResponse = await axios.post(createDocUrl, docData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Document created successfully:', JSON.stringify(createResponse.data, null, 2));
    
    console.log('All tests passed successfully!');
  } catch (error) {
    console.error('Error testing Firestore:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
testDirectFirestore();
