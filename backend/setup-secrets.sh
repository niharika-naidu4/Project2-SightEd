#!/bin/bash

# Exit on any error
set -e

# Configuration
PROJECT_ID="sighted-82cad"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "You are not logged in to gcloud. Please login first with 'gcloud auth login'"
    exit 1
fi

# Check if the project exists and is accessible
if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
    echo "Error: Project $PROJECT_ID does not exist or you don't have access to it."
    exit 1
fi

# Set the current project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable secretmanager.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Load environment variables from .env.production
if [ -f .env.production ]; then
    echo "Loading environment variables from .env.production"
    source .env.production
else
    echo "Error: .env.production file not found"
    exit 1
fi

# Create secrets
echo "Creating secrets in Secret Manager..."

# GEMINI_API_KEY
echo "Creating GEMINI_API_KEY secret..."
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=- --replication-policy="automatic" || \
    echo -n "$GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-

# GOOGLE_CLIENT_EMAIL
echo "Creating GOOGLE_CLIENT_EMAIL secret..."
echo -n "$GOOGLE_CLIENT_EMAIL" | gcloud secrets create firebase-client-email --data-file=- --replication-policy="automatic" || \
    echo -n "$GOOGLE_CLIENT_EMAIL" | gcloud secrets versions add firebase-client-email --data-file=-

# GOOGLE_PRIVATE_KEY
echo "Creating GOOGLE_PRIVATE_KEY secret..."
echo -n "$GOOGLE_PRIVATE_KEY" | gcloud secrets create firebase-private-key --data-file=- --replication-policy="automatic" || \
    echo -n "$GOOGLE_PRIVATE_KEY" | gcloud secrets versions add firebase-private-key --data-file=-

# CLERK_SECRET_KEY
echo "Creating CLERK_SECRET_KEY secret..."
echo -n "$CLERK_SECRET_KEY" | gcloud secrets create clerk-secret-key --data-file=- --replication-policy="automatic" || \
    echo -n "$CLERK_SECRET_KEY" | gcloud secrets versions add clerk-secret-key --data-file=-

# GOOGLE_CLIENT_SECRET
echo "Creating GOOGLE_CLIENT_SECRET secret..."
echo -n "$GOOGLE_CLIENT_SECRET" | gcloud secrets create google-client-secret --data-file=- --replication-policy="automatic" || \
    echo -n "$GOOGLE_CLIENT_SECRET" | gcloud secrets versions add google-client-secret --data-file=-

echo "Secrets created successfully!"

# Get the Cloud Run service account
SERVICE_ACCOUNT=$(gcloud iam service-accounts list --filter="displayName:Cloud Run Service Agent" --format="value(email)")

if [ -z "$SERVICE_ACCOUNT" ]; then
    echo "Cloud Run Service Agent not found. Creating a new service account..."
    SERVICE_ACCOUNT="sighted-backend-sa@$PROJECT_ID.iam.gserviceaccount.com"
    gcloud iam service-accounts create sighted-backend-sa --display-name="SightEd Backend Service Account"
fi

echo "Using service account: $SERVICE_ACCOUNT"

# Grant the service account access to the secrets
echo "Granting the service account access to secrets..."
for SECRET_NAME in gemini-api-key firebase-client-email firebase-private-key clerk-secret-key google-client-secret; do
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor"
done

echo "Setup complete! Your secrets are now configured in Secret Manager."
echo "Service account $SERVICE_ACCOUNT has been granted access to the secrets."
