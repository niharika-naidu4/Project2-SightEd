// Mock database implementation for testing
class MockDatabase {
  constructor() {
    this.collections = {};
  }

  // Collection reference
  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = {};
    }
    
    return {
      doc: (id) => this.doc(name, id),
      add: (data) => this.add(name, data),
      get: () => this.getCollection(name)
    };
  }

  // Document reference
  doc(collectionName, id) {
    return {
      set: (data) => this.set(collectionName, id, data),
      get: () => this.get(collectionName, id),
      id: id
    };
  }

  // Add a document with auto-generated ID
  async add(collectionName, data) {
    const id = 'auto-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    await this.set(collectionName, id, data);
    return {
      id: id,
      get: () => this.get(collectionName, id)
    };
  }

  // Set document data
  async set(collectionName, id, data) {
    if (!this.collections[collectionName]) {
      this.collections[collectionName] = {};
    }
    
    this.collections[collectionName][id] = {
      ...data,
      id: id
    };
    
    console.log(`[MockDB] Document set in ${collectionName}/${id}`);
    return true;
  }

  // Get document data
  async get(collectionName, id) {
    if (!this.collections[collectionName] || !this.collections[collectionName][id]) {
      console.log(`[MockDB] Document not found: ${collectionName}/${id}`);
      return {
        exists: false,
        data: () => null,
        id: id
      };
    }
    
    return {
      exists: true,
      data: () => this.collections[collectionName][id],
      id: id
    };
  }

  // Get all documents in a collection
  async getCollection(collectionName) {
    if (!this.collections[collectionName]) {
      console.log(`[MockDB] Collection not found: ${collectionName}`);
      return {
        empty: true,
        forEach: (callback) => {},
        docs: []
      };
    }
    
    const docs = Object.keys(this.collections[collectionName]).map(id => {
      return {
        id: id,
        data: () => this.collections[collectionName][id],
        exists: true
      };
    });
    
    return {
      empty: docs.length === 0,
      forEach: (callback) => docs.forEach(callback),
      docs: docs,
      size: docs.length
    };
  }

  // List all collections
  async listCollections() {
    return Object.keys(this.collections).map(name => ({
      id: name
    }));
  }
}

module.exports = new MockDatabase();
