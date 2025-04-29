const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// URL of your server's upload endpoint
const uploadUrl = 'http://localhost:5001/upload';

// Path to a test image file (replace with an actual image path)
// You can use any image file on your system
const imagePath = path.join(__dirname, 'test-image.jpg');

// Check if the image file exists
if (!fs.existsSync(imagePath)) {
  console.error(`Error: Image file not found at ${imagePath}`);
  console.log('Please place a test image named "test-image.jpg" in the backend directory');
  process.exit(1);
}

// Create a form with the image file
const form = new FormData();
form.append('image', fs.createReadStream(imagePath));

// Upload the image
async function uploadImage() {
  try {
    console.log('Uploading image...');
    const response = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    console.log('Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    // Get the image ID from the response
    const imageId = response.data.id;

    // Check if the image was stored in the database
    if (imageId) {
      console.log(`\nChecking database for image with ID: ${imageId}`);
      const dbResponse = await axios.get(`http://localhost:5001/api/images/${imageId}`);
      console.log('Database entry:', JSON.stringify(dbResponse.data, null, 2));
    }

    // List all images in the database
    console.log('\nListing all images in the database:');
    const allImagesResponse = await axios.get('http://localhost:5001/api/images');
    console.log('All images:', JSON.stringify(allImagesResponse.data, null, 2));

  } catch (error) {
    console.error('Error uploading image:');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Run the upload function
uploadImage();
