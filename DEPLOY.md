# Deployment Guide: Google Cloud Run

This application is container-ready and "stateless", meaning it stores API keys on the client-side (in your browser), making it very easy to deploy to Google Cloud Run without managing complex server-side secrets.

## Prerequisites

1. **Google Cloud Project**: You need a project with billing enabled.
2. **gcloud CLI**: Installed and authenticated (`gcloud auth login`).
3. **Artifact Registry**: Enabled API for storing Docker images.

## Deployment Steps

### 1. Set your Project ID

```bash
# Replace with your actual Project ID
export PROJECT_ID=your-google-cloud-project-id
gcloud config set project $PROJECT_ID
```

### 2. Enable Required Services

```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 3. Create Artifact Registry (First time only)

```bash
gcloud artifacts repositories create rag-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Repository for RAG System"
```

### 4. Build and Push the Image

Using Cloud Build (easiest method, doesn't require local Docker):

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/rag-repo/rag-system:latest
```

Or building locally:
```bash
docker build -t us-central1-docker.pkg.dev/$PROJECT_ID/rag-repo/rag-system:latest .
docker push us-central1-docker.pkg.dev/$PROJECT_ID/rag-repo/rag-system:latest
```

### 5. Deploy to Cloud Run

```bash
gcloud run deploy rag-system \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/rag-repo/rag-system:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated
```

## Post-Deployment

1. Click the URL provided by Cloud Run (e.g., `https://rag-system-xyz-uc.a.run.app`).
2. Go to **Settings**.
3. Enter your **OpenAI** or **Gemini** API Key (since they are stored in your browser, the deployed app still needs you to enter them).
4. Start using the app!
