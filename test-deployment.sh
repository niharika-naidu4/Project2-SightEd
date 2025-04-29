#!/bin/bash

# Exit on any error
set -e

echo "=== SightEd Deployment Test Script ==="
echo "This script will test the deployed SightEd application."
echo ""

# Get the backend URL
if [ -z "$1" ]; then
    echo "Backend URL not provided. Trying to get it from Google Cloud Run..."
    BACKEND_URL=$(gcloud run services describe sighted-backend --platform managed --region us-central1 --format 'value(status.url)' 2>/dev/null || echo "")
    
    if [ -z "$BACKEND_URL" ]; then
        echo "Error: Could not determine backend URL. Please provide it as the first argument."
        echo "Usage: ./test-deployment.sh <backend-url> <frontend-url>"
        exit 1
    fi
else
    BACKEND_URL=$1
fi

# Get the frontend URL
if [ -z "$2" ]; then
    echo "Frontend URL not provided. Trying to get it from Firebase Hosting..."
    FRONTEND_URL=$(firebase hosting:channel:list --json 2>/dev/null | grep "https://" | head -1 | awk -F'"' '{print $4}' || echo "")
    
    if [ -z "$FRONTEND_URL" ]; then
        FRONTEND_URL="https://sighted-82cad.web.app"
    fi
else
    FRONTEND_URL=$2
fi

echo "Testing backend at: $BACKEND_URL"
echo "Testing frontend at: $FRONTEND_URL"
echo ""

# Test backend health endpoint
echo "=== Testing Backend Health ==="
HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/health")
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test backend Firestore connection
echo ""
echo "=== Testing Backend Firestore Connection ==="
FIRESTORE_RESPONSE=$(curl -s "$BACKEND_URL/test-firestore")
if [[ $FIRESTORE_RESPONSE == *"success"* ]]; then
    echo "✅ Backend Firestore connection test passed"
else
    echo "❌ Backend Firestore connection test failed"
    echo "Response: $FIRESTORE_RESPONSE"
fi

# Test frontend
echo ""
echo "=== Testing Frontend ==="
echo "Opening frontend in browser: $FRONTEND_URL"
if command -v open &> /dev/null; then
    open "$FRONTEND_URL"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$FRONTEND_URL"
elif command -v start &> /dev/null; then
    start "$FRONTEND_URL"
else
    echo "Could not open browser automatically. Please visit: $FRONTEND_URL"
fi

echo ""
echo "=== Manual Testing Checklist ==="
echo "Please verify the following functionality manually:"
echo "1. Home page loads correctly"
echo "2. Authentication with Clerk works"
echo "3. Image upload from device works"
echo "4. Google Photos integration works"
echo "5. Image analysis generates results"
echo "6. Saving analysis results works"
echo "7. Viewing saved results works"
echo ""
echo "If all tests pass, your deployment is successful!"
