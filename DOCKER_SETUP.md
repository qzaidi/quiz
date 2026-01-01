# Docker CI/CD Setup Guide

This repository includes automated Docker image building and publishing via GitHub Actions.

## Prerequisites

1. **Docker Hub Account**
   - Sign up at https://hub.docker.com/
   - Create a repository (e.g., `quiz-app`)

2. **GitHub Repository Secrets**
   - Go to your GitHub repository
   - Navigate to: Settings → Secrets and variables → Actions
   - Add the following secrets:

   | Secret Name | Description | Example |
   |--------------|-------------|---------|
   | `DOCKERHUB_USERNAME` | Your Docker Hub username | `yourusername` |
   | `DOCKERHUB_TOKEN` | Docker Hub access token | `dckr_pat_...` |

## Generating a Docker Hub Token

1. Log in to Docker Hub
2. Click on your avatar → Account Settings → Security
3. Click "New Access Token"
4. Description: `GitHub Actions`
5. Access permissions: Read, Write, Delete
6. Click "Generate"
7. **Copy the token immediately** (you won't see it again!)
8. Add it as `DOCKERHUB_TOKEN` in GitHub secrets

## Configuration

### Update the Workflow

Edit `.github/workflows/docker.yml` line 15:

```yaml
env:
  IMAGE_NAME: your-dockerhub-username/quiz-app  # Change this
```

Replace `your-dockerhub-username` with your actual Docker Hub username.

## Workflow Triggers

The workflow runs on:

- **Push to main branch**: Builds and pushes `:main` and `:latest` tags
- **Tag push** (e.g., `v1.0.0`): Builds and pushes `:v1.0.0`, `:v1.0`, `:v1` tags
- **Pull requests**: Builds image but doesn't push (for testing)

## Building Images

### Automatic Build

Simply push to the `main` branch:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

The GitHub Actions workflow will automatically:
1. Build the Docker image
2. Push it to Docker Hub with the `latest` tag
3. Push it with the `main` branch tag

### Release Build

To create a versioned release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will build and push: `v1.0.0`, `v1.0`, `v1`, and `latest` tags.

## Multi-Architecture Support

The workflow builds images for both:
- `linux/amd64` (Intel/AMD64)
- `linux/arm64` (ARM 64-bit, e.g., Raspberry Pi 4, Apple Silicon)

Docker Hub will automatically create a manifest to serve the correct image.

## Using the Image

### Pull the image:

```bash
docker pull your-dockerhub-username/quiz-app:latest
```

### Run with docker-compose:

Create a `docker-compose.yml`:

```yaml
services:
  app:
    image: your-dockerhub-username/quiz-app:latest
    environment:
      - ADMIN_PASSWORD=your-secret-password
    ports:
      - "80:3000"
    volumes:
      - ./quiz.db:/usr/src/app/quiz.db
```

Then run:

```bash
docker-compose up -d
```

## Workflow Status

Check the build status at:
```
https://github.com/YOUR_USERNAME/YOUR_REPO/actions
```

## Troubleshooting

### Build Fails

1. Check the Actions tab for error logs
2. Verify secrets are correctly set in GitHub repo settings
3. Ensure your Docker Hub repository exists

### Image Not Pushing

1. Verify `DOCKERHUB_TOKEN` has correct permissions (Read, Write, Delete)
2. Check that `DOCKERHUB_USERNAME` matches your Docker Hub username
3. Ensure the repository name in `IMAGE_NAME` exists on Docker Hub

### Authentication Errors

Regenerate your Docker Hub token and update the `DOCKERHUB_TOKEN` secret.

## Security Best Practices

1. **Never commit secrets** to the repository
2. Use minimal permissions for access tokens
3. Rotate tokens periodically
4. Use `secrets` instead of hardcoded values
5. Enable branch protection rules on GitHub
