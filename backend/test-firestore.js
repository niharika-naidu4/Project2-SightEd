const admin = require('firebase-admin');
const serviceAccount = require('./sighted-service-account.json');

console.log('Initializing Firebase with project ID:', serviceAccount.project_id);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

// Get Firestore instance
const db = admin.firestore();

// Log Firestore settings
console.log('Firestore settings:', db._settings);

async function testFirestore() {
  try {
    console.log('Testing Firestore connection...');
    
    // Create a test document
    const docRef = db.collection('test-documents').doc('test-doc-' + Date.now());
    const testData = {
      title: 'Test Document',
      description: 'Created for testing purposes',
      timestamp: new Date().toISOString()
    };
    
    console.log('Creating test document...');
    await docRef.set(testData);
    console.log('Document created successfully!');
    
    // Read the document back
    const docSnapshot = await docRef.get();
    if (docSnapshot.exists) {
      console.log('Document read successfully:', docSnapshot.data());
    } else {
      console.log('Document does not exist after creation!');
    }
    
    // List all collections
    console.log('Listing collections...');
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(col => col.id));
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error testing Firestore:', error);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Run the test
testFirestore();
