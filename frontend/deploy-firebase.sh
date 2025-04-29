#!/bin/bash

# Exit on any error
set -e

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI is not installed. Installing..."
    npm install -g firebase-tools
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "You are not logged in to Firebase. Please login."
    firebase login
fi

# Build the React app with production environment
echo "Building React app for production..."
npm run build

# Deploy to Firebase Hosting
echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

# Get the deployed URL
FIREBASE_URL=$(firebase hosting:channel:list --json | grep "https://" | head -1 | awk -F'"' '{print $4}')
if [ -z "$FIREBASE_URL" ]; then
    FIREBASE_URL="https://sighted-82cad.web.app"
fi

echo "Deployment complete! Your app is live at: $FIREBASE_URL"

# Update the backend .env.production file with the frontend URL if it exists
if [ -f ../backend/.env.production ]; then
    echo "Updating backend .env.production with frontend URL"
    sed -i '' "s|FRONTEND_URL=.*|FRONTEND_URL=$FIREBASE_URL|g" ../backend/.env.production
    echo "Backend .env.production updated with frontend URL: $FIREBASE_URL"
fi
