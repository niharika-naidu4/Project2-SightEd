#!/bin/bash

# Exit on any error
set -e

echo "=== SightEd Full Deployment Script ==="
echo "This script will deploy both the backend and frontend of the SightEd application."
echo ""

# Deploy backend to Google Cloud Run
echo "=== Step 1: Deploying Backend to Google Cloud Run ==="
cd backend

# Set up secrets in Google Cloud Secret Manager
echo "Setting up secrets in Google Cloud Secret Manager..."
./setup-secrets.sh

# Deploy to Google Cloud Run
echo "Deploying backend to Google Cloud Run..."
./deploy-cloud-run.sh

# Get the backend URL
BACKEND_URL=$(gcloud run services describe sighted-backend --platform managed --region us-central1 --format 'value(status.url)')
echo "Backend deployed successfully at: $BACKEND_URL"

# Deploy frontend to Firebase Hosting
echo ""
echo "=== Step 2: Deploying Frontend to Firebase Hosting ==="
cd ../frontend

# Update the frontend .env.production file with the backend URL
echo "Updating frontend .env.production with backend URL: $BACKEND_URL"
sed -i '' "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=$BACKEND_URL|g" .env.production

# Deploy to Firebase Hosting
echo "Deploying frontend to Firebase Hosting..."
./deploy-firebase.sh

echo ""
echo "=== Deployment Complete! ==="
echo "Backend URL: $BACKEND_URL"
FIREBASE_URL=$(firebase hosting:channel:list --json | grep "https://" | head -1 | awk -F'"' '{print $4}')
if [ -z "$FIREBASE_URL" ]; then
    FIREBASE_URL="https://sighted-82cad.web.app"
fi
echo "Frontend URL: $FIREBASE_URL"
echo ""
echo "Don't forget to update the CORS configuration in the backend if needed."
echo "You can test the application by visiting: $FIREBASE_URL"
