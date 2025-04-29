const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const serviceAccount = require('./sighted-service-account.json');

class FirebaseRestClient {
  constructor() {
    this.projectId = serviceAccount.project_id;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
    this.auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/datastore']
    });

    // Cache for auth tokens to avoid too many requests
    this.authTokenCache = {
      token: null,
      expiry: 0
    };
  }

  async getAuthToken() {
    // Check if we have a valid cached token
    const now = Date.now();
    if (this.authTokenCache.token && this.authTokenCache.expiry > now) {
      return this.authTokenCache.token;
    }

    // Get a new token
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();

    // Cache the token with a 55-minute expiry (tokens typically last 1 hour)
    this.authTokenCache.token = tokenResponse.token;
    this.authTokenCache.expiry = now + (55 * 60 * 1000);

    return tokenResponse.token;
  }

  // Firestore SDK compatible methods
  collection(collectionId) {
    return new CollectionReference(this, collectionId);
  }

  // Original methods
  async createDocument(collectionId, documentId, data) {
    try {
      const token = await this.getAuthToken();
      const url = `${this.baseUrl}/${collectionId}${documentId ? '/' + documentId : ''}`;

      // Convert data to Firestore format
      const firestoreData = {
        fields: this.convertToFirestoreFields(data)
      };

      const response = await axios.post(url, firestoreData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        id: documentId || this.getIdFromPath(response.data.name),
        ...this.convertFromFirestoreFields(response.data.fields)
      };
    } catch (error) {
      console.error('Error creating document:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async getDocument(collectionId, documentId) {
    try {
      const token = await this.getAuthToken();
      const url = `${this.baseUrl}/${collectionId}/${documentId}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return {
        id: documentId,
        ...this.convertFromFirestoreFields(response.data.fields)
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      console.error('Error getting document:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async listDocuments(collectionId) {
    try {
      const token = await this.getAuthToken();
      const url = `${this.baseUrl}/${collectionId}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data.documents) {
        return [];
      }

      return response.data.documents.map(doc => ({
        id: this.getIdFromPath(doc.name),
        ...this.convertFromFirestoreFields(doc.fields)
      }));
    } catch (error) {
      console.error('Error listing documents:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async updateDocument(collectionId, documentId, data) {
    try {
      const token = await this.getAuthToken();
      const url = `${this.baseUrl}/${collectionId}/${documentId}?updateMask.fieldPaths=${Object.keys(data).join('&updateMask.fieldPaths=')}`;

      // Convert data to Firestore format
      const firestoreData = {
        fields: this.convertToFirestoreFields(data)
      };

      const response = await axios.patch(url, firestoreData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        id: documentId,
        ...this.convertFromFirestoreFields(response.data.fields)
      };
    } catch (error) {
      console.error('Error updating document:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async deleteDocument(collectionId, documentId) {
    try {
      const token = await this.getAuthToken();
      const url = `${this.baseUrl}/${collectionId}/${documentId}`;

      await axios.delete(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return true;
    } catch (error) {
      console.error('Error deleting document:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  // Helper method to convert JS object to Firestore fields format
  convertToFirestoreFields(data) {
    const fields = {};

    for (const [key, value] of Object.entries(data)) {
      fields[key] = this.convertValueToFirestoreValue(value);
    }

    return fields;
  }

  // Helper method to convert a single value to Firestore value format
  convertValueToFirestoreValue(value) {
    if (value === null || value === undefined) {
      return { nullValue: null };
    } else if (typeof value === 'string') {
      return { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { integerValue: value.toString() };
      } else {
        return { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      return { booleanValue: value };
    } else if (value instanceof Date) {
      return { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map(item => this.convertValueToFirestoreValue(item))
        }
      };
    } else if (typeof value === 'object') {
      return {
        mapValue: {
          fields: this.convertToFirestoreFields(value)
        }
      };
    }

    // Default to string if type is not supported
    return { stringValue: String(value) };
  }

  // Helper method to convert Firestore fields to JS object
  convertFromFirestoreFields(fields) {
    if (!fields) return {};

    const result = {};

    for (const [key, value] of Object.entries(fields)) {
      result[key] = this.convertFirestoreValueToValue(value);
    }

    return result;
  }

  // Helper method to convert a single Firestore value to JS value
  convertFirestoreValueToValue(firestoreValue) {
    if (firestoreValue.nullValue !== undefined) {
      return null;
    } else if (firestoreValue.stringValue !== undefined) {
      return firestoreValue.stringValue;
    } else if (firestoreValue.integerValue !== undefined) {
      return parseInt(firestoreValue.integerValue, 10);
    } else if (firestoreValue.doubleValue !== undefined) {
      return firestoreValue.doubleValue;
    } else if (firestoreValue.booleanValue !== undefined) {
      return firestoreValue.booleanValue;
    } else if (firestoreValue.timestampValue !== undefined) {
      return new Date(firestoreValue.timestampValue);
    } else if (firestoreValue.arrayValue !== undefined) {
      return (firestoreValue.arrayValue.values || []).map(item =>
        this.convertFirestoreValueToValue(item)
      );
    } else if (firestoreValue.mapValue !== undefined) {
      return this.convertFromFirestoreFields(firestoreValue.mapValue.fields);
    }

    return null;
  }

  // Helper method to extract document ID from path
  getIdFromPath(path) {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }
}

// DocumentReference class to mimic Firestore SDK
class DocumentReference {
  constructor(client, collectionId, documentId) {
    this.client = client;
    this.collectionId = collectionId;
    this.id = documentId;
    this._path = `${collectionId}/${documentId}`;
  }

  // Get the document
  async get() {
    try {
      const data = await this.client.getDocument(this.collectionId, this.id);
      if (!data) {
        return {
          exists: false,
          id: this.id,
          data: () => null
        };
      }

      return {
        exists: true,
        id: this.id,
        data: () => data
      };
    } catch (error) {
      console.error(`Error getting document ${this._path}:`, error);
      throw error;
    }
  }

  // Set document data
  async set(data) {
    try {
      return await this.client.createDocument(this.collectionId, this.id, data);
    } catch (error) {
      console.error(`Error setting document ${this._path}:`, error);
      throw error;
    }
  }

  // Update document data
  async update(data) {
    try {
      return await this.client.updateDocument(this.collectionId, this.id, data);
    } catch (error) {
      console.error(`Error updating document ${this._path}:`, error);
      throw error;
    }
  }

  // Delete the document
  async delete() {
    try {
      return await this.client.deleteDocument(this.collectionId, this.id);
    } catch (error) {
      console.error(`Error deleting document ${this._path}:`, error);
      throw error;
    }
  }

  // Create a subcollection
  collection(collectionId) {
    return new CollectionReference(this.client, `${this._path}/${collectionId}`);
  }
}

// CollectionReference class to mimic Firestore SDK
class CollectionReference {
  constructor(client, collectionId) {
    this.client = client;
    this.id = collectionId;
    this._path = collectionId;
  }

  // Get a document reference
  doc(documentId) {
    return new DocumentReference(this.client, this.id, documentId || this._generateId());
  }

  // Get all documents in the collection
  async get() {
    try {
      const documents = await this.client.listDocuments(this.id);
      return {
        empty: documents.length === 0,
        size: documents.length,
        docs: documents.map(doc => ({
          id: doc.id,
          exists: true,
          data: () => doc
        }))
      };
    } catch (error) {
      console.error(`Error getting collection ${this.id}:`, error);
      throw error;
    }
  }

  // Add a document with auto-generated ID
  async add(data) {
    const docId = this._generateId();
    const docRef = this.doc(docId);
    await docRef.set(data);
    return docRef;
  }

  // Generate a random document ID
  _generateId() {
    return 'auto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
  }
}

// Create and export a singleton instance
const firebaseRestClient = new FirebaseRestClient();
module.exports = firebaseRestClient;
