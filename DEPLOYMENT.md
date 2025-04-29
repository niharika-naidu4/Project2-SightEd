# SightEd Deployment Guide

This guide provides instructions for deploying the SightEd application to Google Cloud Run (backend) and Firebase Hosting (frontend).

## Prerequisites

Before you begin, make sure you have the following:

1. **Google Cloud Account** with billing enabled
2. **Firebase Account** (can use the same Google account)
3. **Node.js** and **npm** installed
4. **Google Cloud CLI** (`gcloud`) installed and configured
5. **Firebase CLI** (`firebase`) installed and configured

## Setup Instructions

### 1. Install Required Tools

```bash
# Install Google Cloud CLI
# Follow instructions at: https://cloud.google.com/sdk/docs/install

# Install Firebase CLI
npm install -g firebase-tools

# Login to Google Cloud
gcloud auth login

# Login to Firebase
firebase login
```

### 2. Configure Google Cloud Project

```bash
# Set your Google Cloud project
gcloud config set project sighted-82cad

# Enable required APIs
gcloud services enable secretmanager.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firestore.googleapis.com
```

## Deployment Options

You have three options for deploying the SightEd application:

### Option 1: Full Deployment (Recommended)

This option deploys both the backend and frontend in one go:

```bash
# From the project root directory
./deploy.sh
```

### Option 2: Deploy Backend Only

```bash
# From the backend directory
cd backend
./setup-secrets.sh
./deploy-cloud-run.sh
```

### Option 3: Deploy Frontend Only

```bash
# From the frontend directory
cd frontend
./deploy-firebase.sh
```

## Manual Deployment Steps

If you prefer to deploy manually or if the scripts don't work for you, follow these steps:

### Backend Deployment to Google Cloud Run

1. **Set up secrets in Google Cloud Secret Manager**:

```bash
# Create secrets
gcloud secrets create gemini-api-key --data-file=<(echo -n "YOUR_GEMINI_API_KEY")
gcloud secrets create firebase-client-email --data-file=<(echo -n "firebase-adminsdk-fbsvc@sighted-82cad.iam.gserviceaccount.com")
gcloud secrets create firebase-private-key --data-file=<(echo -n "YOUR_PRIVATE_KEY")
gcloud secrets create clerk-secret-key --data-file=<(echo -n "YOUR_CLERK_SECRET_KEY")
gcloud secrets create google-client-secret --data-file=<(echo -n "YOUR_GOOGLE_CLIENT_SECRET")

# Grant access to Cloud Run service account
SERVICE_ACCOUNT="sighted-backend-sa@sighted-82cad.iam.gserviceaccount.com"
gcloud iam service-accounts create sighted-backend-sa --display-name="SightEd Backend Service Account"

for SECRET_NAME in gemini-api-key firebase-client-email firebase-private-key clerk-secret-key google-client-secret; do
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor"
done
```

2. **Build and deploy the backend**:

```bash
# From the backend directory
gcloud builds submit --tag gcr.io/sighted-82cad/sighted-backend

gcloud run deploy sighted-backend \
  --image gcr.io/sighted-82cad/sighted-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=https://sighted-app.web.app" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CLIENT_EMAIL=firebase-client-email:latest,GOOGLE_PRIVATE_KEY=firebase-private-key:latest,CLERK_SECRET_KEY=clerk-secret-key:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest"
```

### Frontend Deployment to Firebase Hosting

1. **Build the React app**:

```bash
# From the frontend directory
npm run build
```

2. **Deploy to Firebase Hosting**:

```bash
# From the frontend directory
firebase deploy --only hosting
```

## Verifying Deployment

After deployment, verify that everything is working correctly:

1. **Test the backend API**:
```bash
curl https://your-backend-url/health
```

2. **Test the frontend**:
   - Open the Firebase Hosting URL in your browser
   - Try uploading an image
   - Test authentication
   - Test saving and retrieving data

## Troubleshooting

If you encounter issues during deployment:

1. **Check Cloud Run logs**:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sighted-backend" --limit 50
```

2. **Check Firebase Hosting deployment**:
```bash
firebase hosting:channel:list
```

3. **Verify environment variables**:
```bash
gcloud run services describe sighted-backend --format="yaml(spec.template.spec.containers[0].env)"
```

## Updating the Deployment

To update your deployment after making changes:

1. **Backend updates**:
```bash
cd backend
./deploy-cloud-run.sh
```

2. **Frontend updates**:
```bash
cd frontend
./deploy-firebase.sh
```

## Security Considerations

- All API keys and secrets are stored in Google Cloud Secret Manager
- The backend API is secured with CORS to only allow requests from the frontend domain
- Authentication is handled by Clerk
- Firebase Security Rules are in place to protect your data
