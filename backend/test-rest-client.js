const firebaseRestClient = require('./firebase-rest-client');

async function testRestClient() {
  try {
    console.log('Testing Firebase REST client...');
    
    // Create a test document
    const docId = 'test-doc-' + Date.now();
    const testData = {
      title: 'Test Document via REST API',
      description: 'Created for testing purposes using the REST API',
      timestamp: new Date().toISOString(),
      nested: {
        field1: 'value1',
        field2: 42
      },
      tags: ['test', 'rest', 'api']
    };
    
    console.log('Creating test document...');
    const createdDoc = await firebaseRestClient.createDocument('test-documents', docId, testData);
    console.log('Document created successfully:', createdDoc);
    
    // Read the document back
    console.log('Reading document...');
    const retrievedDoc = await firebaseRestClient.getDocument('test-documents', docId);
    console.log('Document retrieved successfully:', retrievedDoc);
    
    // List documents in the collection
    console.log('Listing documents in collection...');
    const documents = await firebaseRestClient.listDocuments('test-documents');
    console.log('Documents in collection:', documents.length);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error testing Firebase REST client:', error);
  }
}

// Run the test
testRestClient();
