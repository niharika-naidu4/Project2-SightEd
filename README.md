# SightEd - Educational Image Analysis App

SightEd is an educational application that uses Google Vision API and Google Gemini API to analyze images and generate educational content.

## Features

- **Image Analysis**: Upload images to get detailed analysis using Google Vision API
- **AI Description**: Get AI-generated descriptions of the image content
- **Label Detection**: Identify objects, scenes, and concepts in images
- **Landmark Recognition**: Identify famous landmarks in images
- **Quiz Generation**: Generate educational quizzes based on image content using Google Gemini API
- **Save Insights**: Store analysis results for future reference
- **Social Media Integration**: Import images directly from Google Photos and other platforms

## Technology Stack

### Backend
- Node.js
- Express.js
- Firebase Firestore (database)
- Google Cloud Vision API
- Google Gemini API

### Frontend
- React
- TypeScript
- Material-UI
- React Router
- Clerk for authentication
- Google OAuth for Google Photos integration
- Google Photos API integration

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Google Cloud account with Vision API and Gemini API enabled
- Firebase project

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd SightEd/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=5001
   NODE_ENV=development
   GOOGLE_APPLICATION_CREDENTIALS=./sighted-service-account.json
   GOOGLE_CLIENT_EMAIL=your-firebase-client-email
   GOOGLE_PRIVATE_KEY="your-firebase-private-key"
   GEMINI_API_KEY="your-gemini-api-key"
   ```

4. Place your Firebase service account JSON file in the backend directory as `sighted-service-account.json`

5. Start the backend server:
   ```
   npm start
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd SightEd/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   REACT_APP_API_URL=http://localhost:5001
   REACT_APP_GOOGLE_API_KEY=your-google-api-key
   REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
   ```

   To get the Google API Key and Client ID:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Photos Library API and Google People API
   - Create OAuth 2.0 credentials (Web application type)
   - Add authorized JavaScript origins (e.g., http://localhost:3000)
   - Add authorized redirect URIs (e.g., http://localhost:3000)

4. Start the frontend development server:
   ```
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Option 1: Full Deployment (Recommended)

This option deploys both the backend and frontend in one go:

```bash
# From the project root directory
./deploy.sh
```

### Option 2: Deploy Backend to Google Cloud Run

1. Navigate to the backend directory:
   ```
   cd SightEd/backend
   ```

2. Set up secrets in Google Cloud Secret Manager:
   ```
   ./setup-secrets.sh
   ```

3. Run the deployment script:
   ```
   ./deploy-cloud-run.sh
   ```

### Option 3: Deploy Frontend to Firebase Hosting

1. Navigate to the frontend directory:
   ```
   cd SightEd/frontend
   ```

2. Run the deployment script:
   ```
   ./deploy-firebase.sh
   ```

The deployment scripts will automatically update the necessary environment variables and configuration files.

## Usage

1. Upload an image on the home page (either from your device or from Google Photos)
2. View the analysis results including AI description, labels, and landmarks
3. Take a quiz based on the image content
4. View saved insights from previous analyses
5. Import images directly from your Google Photos account

## License

This project is licensed under the MIT License.
