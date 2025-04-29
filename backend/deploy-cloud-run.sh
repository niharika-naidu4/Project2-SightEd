#!/bin/bash

# Exit on any error
set -e

# Configuration
PROJECT_ID="sighted-82cad"
SERVICE_NAME="sighted-backend"
REGION="us-central1"

# Load environment variables from .env.production
if [ -f .env.production ]; then
  echo "Loading environment variables from .env.production"
  # Don't use export with xargs as it can't handle multiline values properly
  # Instead, load specific variables we need
  GEMINI_API_KEY=$(grep GEMINI_API_KEY .env.production | cut -d '=' -f2- | tr -d '"')
  GOOGLE_CLIENT_EMAIL=$(grep GOOGLE_CLIENT_EMAIL .env.production | cut -d '=' -f2-)
  # We'll handle the private key separately in the deployment command
else
  echo "Warning: .env.production file not found"
fi

# Build the container image
echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."

# Create a temporary file for the private key
PRIVATE_KEY_FILE=$(mktemp)
grep -o 'GOOGLE_PRIVATE_KEY="[^"]*"' .env.production | sed 's/GOOGLE_PRIVATE_KEY=//g' > $PRIVATE_KEY_FILE

# Deploy using secrets instead of environment variables
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="FRONTEND_URL=https://sighted-app.web.app" \
  --set-env-vars="REDIRECT_URI=https://sighted-app.web.app/oauth-callback" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CLIENT_EMAIL=firebase-client-email:latest,GOOGLE_PRIVATE_KEY=firebase-private-key:latest,CLERK_SECRET_KEY=clerk-secret-key:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest"

# Remove the temporary file
rm $PRIVATE_KEY_FILE

# Get the URL of the deployed service
URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo "Deployment complete! Your service is available at: $URL"

# Update the frontend .env file with the backend URL
if [ -f ../frontend/.env.production ]; then
  echo "Updating frontend .env.production with backend URL"
  sed -i '' "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=$URL|g" ../frontend/.env.production
  echo "Frontend .env.production updated with backend URL: $URL"
else
  echo "Creating frontend .env.production with backend URL"
  echo "REACT_APP_API_URL=$URL" > ../frontend/.env.production
  echo "REACT_APP_GOOGLE_CLIENT_ID=438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com" >> ../frontend/.env.production
  echo "REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_c21hcnQtbGl6YXJkLTkyLmNsZXJrLmFjY291bnRzLmRldiQ" >> ../frontend/.env.production
  echo "Frontend .env.production created with backend URL: $URL"
fi
