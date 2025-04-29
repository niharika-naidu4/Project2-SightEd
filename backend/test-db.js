// Test script to verify Firestore database connection and operations
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5001';

// Test image path (using a sample image)
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

// Function to test uploading an image
async function testImageUpload() {
  console.log('Testing image upload to Firestore...');
  
  try {
    // Check if test image exists
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.error('Test image not found at:', TEST_IMAGE_PATH);
      return false;
    }
    
    // Create form data with the image
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', fs.createReadStream(TEST_IMAGE_PATH));
    
    // Upload the image
    console.log('Uploading image...');
    const uploadResponse = await axios.post(`${API_URL}/api/analyze`, form, {
      headers: {
        ...form.getHeaders(),
      },
    });
    
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response data:', JSON.stringify(uploadResponse.data, null, 2));
    
    // Check if we got an image ID back
    if (uploadResponse.data && uploadResponse.data.id) {
      const imageId = uploadResponse.data.id;
      console.log('Successfully uploaded image with ID:', imageId);
      
      // Now try to retrieve the image data
      console.log('Retrieving image data...');
      const getResponse = await axios.get(`${API_URL}/api/images/${imageId}`);
      
      console.log('Get response status:', getResponse.status);
      console.log('Get response data:', JSON.stringify(getResponse.data, null, 2));
      
      if (getResponse.data && getResponse.data.id === imageId) {
        console.log('Successfully retrieved image data from Firestore!');
        return true;
      } else {
        console.error('Failed to retrieve correct image data');
        return false;
      }
    } else {
      console.error('Failed to get image ID from upload response');
      return false;
    }
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Function to test creating a direct document
async function testDirectDocument() {
  console.log('\nTesting direct document creation in Firestore...');
  
  try {
    // Create a test document
    const testData = {
      title: 'Test Document',
      description: 'This is a test document to verify Firestore connection',
      timestamp: new Date().toISOString(),
      testValue: Math.random()
    };
    
    console.log('Creating test document...');
    const createResponse = await axios.post(`${API_URL}/api/test-document`, testData);
    
    console.log('Create response status:', createResponse.status);
    console.log('Create response data:', JSON.stringify(createResponse.data, null, 2));
    
    // Check if we got a document ID back
    if (createResponse.data && createResponse.data.id) {
      const docId = createResponse.data.id;
      console.log('Successfully created document with ID:', docId);
      
      // Now try to retrieve the document
      console.log('Retrieving document...');
      const getResponse = await axios.get(`${API_URL}/api/test-document/${docId}`);
      
      console.log('Get response status:', getResponse.status);
      console.log('Get response data:', JSON.stringify(getResponse.data, null, 2));
      
      if (getResponse.data && getResponse.data.id === docId) {
        console.log('Successfully retrieved document from Firestore!');
        return true;
      } else {
        console.error('Failed to retrieve correct document');
        return false;
      }
    } else {
      console.error('Failed to get document ID from create response');
      return false;
    }
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('Starting Firestore database tests...');
  
  // First, let's add endpoints for our test
  try {
    // Add test document endpoint
    await axios.post(`${API_URL}/api/add-test-endpoints`, {
      secret: 'test-mode-activate'
    });
    console.log('Added test endpoints successfully');
  } catch (error) {
    console.error('Failed to add test endpoints:', error.message);
    // Continue anyway, the endpoints might already exist
  }
  
  // Run the direct document test first (simpler)
  const docTestResult = await testDirectDocument();
  console.log('\nDirect document test result:', docTestResult ? 'PASSED' : 'FAILED');
  
  // Then try the image upload test
  const imageTestResult = await testImageUpload();
  console.log('\nImage upload test result:', imageTestResult ? 'PASSED' : 'FAILED');
  
  console.log('\nAll tests completed.');
  
  if (docTestResult && imageTestResult) {
    console.log('✅ ALL TESTS PASSED - Firestore database is working correctly!');
  } else {
    console.log('❌ SOME TESTS FAILED - Check the logs above for details.');
  }
}

// Run the tests
runTests().catch(console.error);
