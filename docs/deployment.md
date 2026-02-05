# Deployment Guide

This project is configured for deployment on [Vercel](https://vercel.com).

## Prerequisites
- A Vercel account.
- The project pushed to a Git repository (GitHub, GitLab, or Bitbucket).

## Configuration
The project uses `vite` and is a Single Page Application (SPA).
A `vercel.json` file is included to handle client-side routing rewrites:

```json
{
    "rewrites": [
        {
            "source": "/(.*)",
            "destination": "/index.html"
        }
    ]
}
```

## Deployment Steps

1.  **Import Project in Vercel**:
    - Go to your Vercel Dashboard.
    - Click **"Add New..."** -> **"Project"**.
    - Import your Git repository.

2.  **Configure Project**:
    - **Framework Preset**: Vercel should automatically detect `Vite`. If not, select it manually.
    - **Build Command**: `npm run build` (default).
    - **Output Directory**: `dist` (default).
    - **Install Command**: `npm install` (default).

3.  **Environment Variables**:
    - This project currently does not rely on any specific environment variables for the build.
    - If you add environment variables later, add them in the **Environment Variables** section of the project settings in Vercel.

4.  **Deploy**:
    - Click **"Deploy"**.

## Local Build
To test the build locally:
```bash
npm run build
npm run preview
```
