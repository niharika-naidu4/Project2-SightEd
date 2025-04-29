// Debug script to print the contents of the mock database
const db = require('./mock-db');

// Add some test data to the mock database
async function addTestData() {
  console.log('Adding test data to mock database...');

  // Add a test collection
  await db.collection('test-collection').doc('test-doc').set({
    name: 'Test Document',
    description: 'This is a test document',
    createdAt: new Date().toISOString()
  });

  // Add a test image
  await db.collection('images').doc('test-image').set({
    title: 'Test Image',
    aiDescription: 'This is a test image description',
    scientificFacts: [
      'Fact 1: This is a test fact',
      'Fact 2: This is another test fact',
      'Fact 3: This is a third test fact'
    ],
    quickQuiz: [
      {
        question: 'What is this?',
        options: ['A test', 'Not a test', 'Something else', 'None of the above'],
        correctAnswer: 0,
        explanation: 'This is a test document for debugging purposes'
      }
    ],
    createdAt: new Date().toISOString()
  });

  console.log('Test data added successfully!');
}

// Function to print all collections and documents
async function printDatabase() {
  console.log('\n=== MOCK DATABASE CONTENTS ===\n');

  // Get all collections
  const collections = await db.listCollections();
  console.log(`Found ${collections.length} collections:`);

  // For each collection, print all documents
  for (const collection of collections) {
    const collectionName = collection.id;
    console.log(`\nCollection: ${collectionName}`);

    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
      console.log('  No documents in this collection');
      continue;
    }

    console.log(`  Found ${snapshot.size} documents:`);

    snapshot.forEach(doc => {
      console.log(`  - Document ID: ${doc.id}`);
      const data = doc.data();

      // Print a summary of the document data
      if (data) {
        const keys = Object.keys(data);
        console.log(`    Keys: ${keys.join(', ')}`);

        // For each key, print a preview of the value
        keys.forEach(key => {
          const value = data[key];
          let preview;

          if (typeof value === 'string') {
            preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
          } else if (Array.isArray(value)) {
            preview = `Array with ${value.length} items`;
          } else if (typeof value === 'object' && value !== null) {
            preview = `Object with keys: ${Object.keys(value).join(', ')}`;
          } else {
            preview = String(value);
          }

          console.log(`    ${key}: ${preview}`);
        });
      }
    });
  }

  console.log('\n=== END OF DATABASE CONTENTS ===\n');
}

// Run the functions
async function main() {
  try {
    await addTestData();
    await printDatabase();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
