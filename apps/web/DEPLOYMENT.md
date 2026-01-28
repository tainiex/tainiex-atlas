# Frontend Deployment Guide

This document describes how to deploy the Tainiex frontend application to Firebase Hosting.

## Overview

- **Deployment Target**: Firebase Hosting
- **CI/CD**: GitHub Actions (automated on main branch)
- **Build Tool**: Vite 7.x
- **Framework**: React 18.3 + TypeScript

## Automated Deployment (CI/CD)

The frontend is automatically deployed to Firebase Hosting when changes are pushed to the `main` branch.

### Workflow Trigger

The deployment workflow ([.github/workflows/deploy-firebase-prod.yml](../../.github/workflows/deploy-firebase-prod.yml)) is triggered when:

- Code is pushed to the `main` branch
- Changes affect any of these paths:
  - `apps/web/**`
  - `packages/shared-atlas/**`
  - `.github/workflows/deploy-firebase-prod.yml`

### Build Process

1. Install dependencies using pnpm
2. Build shared types package (`@tainiex/shared-atlas`)
3. Build frontend with Vite
4. Deploy to Firebase Hosting

## Required GitHub Secrets

本项目使用**单个 secret** 来存储所有环境变量，便于统一管理。

### 配置方法

进入 GitHub 仓库 → Settings → Secrets and variables → Actions，配置以下 3 个 secrets：

#### 1. ENV_WEB_PRODUCTION (前端环境变量)
包含所有前端构建时需要的环境变量：

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_API_BASE_URL=https://your-api-url.run.app
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_CLARITY_ID=your_clarity_id_here
```

#### 2. GCP_SA_KEY (Google Cloud 服务账号)
- Google Cloud 服务账号的 JSON 密钥文件内容
- 用于认证 Firebase Hosting 部署

#### 3. GCP_PROJECT_ID (GCP 项目 ID)
- 您的 Google Cloud 项目 ID
- 格式: `tainiex-prod-123456`

### 详细配置指南

完整的配置模板和说明请查看：[ENV_SECRETS_TEMPLATE.md](../../.github/ENV_SECRETS_TEMPLATE.md)

**注意**: 如果从 `tainiex-lens` 迁移，可以直接复制现有的环境变量值。

## Manual Deployment

### Prerequisites

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Set the GCP project:
   ```bash
   firebase use <PROJECT_ID>
   ```

### Deploy from Root Directory

```bash
# Build and deploy frontend only
pnpm deploy:web

# Or step by step:
pnpm build:web
firebase deploy --only hosting --project <PROJECT_ID>
```

### Deploy from apps/web Directory

```bash
cd apps/web

# Build the frontend
pnpm build

# Deploy to Firebase
firebase deploy --only hosting
```

## Environment Variables

### Build-Time Variables (Vite)

All environment variables must be prefixed with `VITE_` to be embedded in the build:

- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_MICROSOFT_CLIENT_ID` - Microsoft OAuth client ID
- `VITE_SENTRY_DSN` - Sentry DSN
- `VITE_CLARITY_ID` - Microsoft Clarity ID

### Local Development

Create a `.env` file in `apps/web/`:

```env
VITE_API_BASE_URL=http://localhost:2020
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id
VITE_SENTRY_DSN=your_sentry_dsn
VITE_CLARITY_ID=your_clarity_id
```

**Important**: Never commit `.env` files with real credentials to git.

## Firebase Configuration

The Firebase Hosting configuration is defined in [firebase.json](firebase.json):

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

This configuration:
- Serves static files from the `dist/` directory
- Rewrites all routes to `index.html` for SPA routing support
- Enables client-side routing with React Router

## OAuth Configuration

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create or edit OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://your-project.web.app`
   - `https://your-custom-domain.com` (if using custom domain)
4. Copy the Client ID to `VITE_GOOGLE_CLIENT_ID` secret

### Microsoft OAuth (Azure AD)

1. Go to [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps)
2. Create or edit App Registration
3. Add redirect URIs in "Authentication":
   - `https://your-project.web.app`
   - `https://your-custom-domain.com` (if using custom domain)
4. Copy the Application (client) ID to `VITE_MICROSOFT_CLIENT_ID` secret

## Verification Checklist

After deployment, verify the following:

### 1. Deployment Success
- [ ] GitHub Actions workflow completed successfully
- [ ] Firebase Console shows new deployment in Hosting section
- [ ] No build errors in workflow logs

### 2. Frontend Functionality
- [ ] Visit the deployed URL
- [ ] Test Google OAuth login
- [ ] Test Microsoft OAuth login
- [ ] Verify API connectivity (check Network tab)
- [ ] Test real-time features (Socket.io connection)
- [ ] Test collaborative editing (if applicable)

### 3. Monitoring & Analytics
- [ ] Sentry receives error events (test with intentional error)
- [ ] Microsoft Clarity tracks page views
- [ ] Firebase Analytics shows traffic (if enabled)

### 4. Performance
- [ ] Check Lighthouse score (should be > 90 for Performance)
- [ ] Verify bundle size is reasonable (< 5MB total)
- [ ] Test loading speed on slow network (3G simulation)

### 5. SPA Routing
- [ ] Test deep linking (e.g., `/documents/123`)
- [ ] Verify all routes load correctly (no 404s)
- [ ] Check browser back/forward navigation

## Rollback Procedures

### Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Hosting → Release history
4. Find the previous working version
5. Click "Rollback"

### Using Firebase CLI

```bash
# View deployment history
firebase hosting:channel:list

# Rollback to previous version
firebase hosting:rollback
```

### Using GitHub Actions

1. Revert the problematic commit
2. Push to main branch
3. New deployment will automatically trigger

## Troubleshooting

### Build Fails in CI/CD

1. Check GitHub Actions logs for error details
2. Verify all environment variables are set correctly
3. Test build locally:
   ```bash
   pnpm --filter @tainiex/web build
   ```
4. Ensure dependencies are up to date:
   ```bash
   pnpm install --frozen-lockfile
   ```

### Authentication Not Working

1. Verify OAuth redirect URIs are configured correctly
2. Check that `VITE_GOOGLE_CLIENT_ID` and `VITE_MICROSOFT_CLIENT_ID` are set
3. Ensure domain matches the redirect URI exactly (including https://)
4. Check browser console for CORS errors

### API Connectivity Issues

1. Verify `VITE_API_BASE_URL` points to the correct backend URL
2. Check CORS configuration on the backend
3. Ensure backend service is running and accessible
4. Check Network tab in browser DevTools for failed requests

### Firebase Deployment Fails

1. Verify `GCP_SA_KEY` has correct permissions:
   - Firebase Hosting Admin
   - Cloud Run Admin (if using Cloud Run)
2. Check Firebase project quota and billing
3. Ensure `GCP_PROJECT_ID` matches the Firebase project ID

## Custom Domain Setup

To use a custom domain with Firebase Hosting:

1. Go to Firebase Console → Hosting → Add custom domain
2. Follow the DNS verification steps
3. Add DNS records as instructed by Firebase
4. Wait for SSL certificate provisioning (can take up to 24 hours)
5. Update OAuth redirect URIs with the new domain

## Monitoring & Logs

### Firebase Hosting Logs

View access logs in Firebase Console → Hosting → Usage

### Error Tracking

Errors are automatically sent to Sentry if `VITE_SENTRY_DSN` is configured.

View errors at: https://sentry.io/organizations/your-org/issues/

### Analytics

- **Firebase Analytics**: Firebase Console → Analytics
- **Microsoft Clarity**: https://clarity.microsoft.com/
- **Google Analytics**: If configured in the app

## Additional Resources

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [React Router Documentation](https://reactrouter.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Support

For issues or questions:
- Check the [main project README](../../README.md)
- Open an issue on GitHub
- Contact the development team
