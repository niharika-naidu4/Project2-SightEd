const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Mock the Firebase Admin SDK
jest.mock('firebase-admin', () => {
  return {
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn()
    },
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        add: jest.fn().mockResolvedValue({ id: 'test-id' }),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          forEach: jest.fn(callback => {
            callback({
              id: 'test-id',
              data: () => ({
                labels: [{ description: 'test', score: 0.9 }],
                landmarks: [{ description: 'landmark', score: 0.8, locations: [] }],
                aiDescription: 'test description',
                createdAt: { toDate: () => new Date() }
              })
            });
          })
        })
      }))
    }))
  };
});

// Mock the Google Cloud Vision API
jest.mock('@google-cloud/vision', () => {
  return {
    ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
      labelDetection: jest.fn().mockResolvedValue([{
        labelAnnotations: [
          { description: 'test', score: 0.9 }
        ]
      }]),
      landmarkDetection: jest.fn().mockResolvedValue([{
        landmarkAnnotations: [
          { description: 'landmark', score: 0.8, locations: [] }
        ]
      }])
    }))
  };
});

// Import the server after mocking dependencies
const app = require('../server');

describe('Server API Tests', () => {
  // Test the root endpoint
  test('GET / should return welcome message', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message', 'Welcome to SightEd API');
  });

  // Test the /saved endpoint
  test('GET /saved should return saved images', async () => {
    const response = await request(app).get('/saved');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('labels');
    expect(response.body[0]).toHaveProperty('landmarks');
    expect(response.body[0]).toHaveProperty('aiDescription');
  });

  // Test the /upload endpoint with a mock image
  test('POST /upload should process an image and return analysis', async () => {
    // Create a mock image file
    const mockImagePath = path.join(__dirname, 'mock-image.jpg');
    fs.writeFileSync(mockImagePath, 'mock image content');
    
    const response = await request(app)
      .post('/upload')
      .attach('image', mockImagePath);
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('labels');
    expect(response.body).toHaveProperty('landmarks');
    expect(response.body).toHaveProperty('aiDescription');
    expect(response.body).toHaveProperty('message', 'Image analysis saved successfully');
    
    // Clean up the mock file
    fs.unlinkSync(mockImagePath);
  });

  // Test the /upload endpoint with no image
  test('POST /upload should return error when no image is provided', async () => {
    const response = await request(app)
      .post('/upload')
      .attach('image', '');
    
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error', 'No image file provided');
  });
}); 