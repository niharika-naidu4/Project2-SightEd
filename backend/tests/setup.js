// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = 5001;
process.env.GOOGLE_APPLICATION_CREDENTIALS = './test-credentials.json';

// Mock console.error to avoid cluttering test output
console.error = jest.fn(); 