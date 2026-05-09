# 🚀 RhinoAlgo YT Engine — Complete Setup Guide

## What this does
- Connects to your YouTube channel via Google OAuth (no password stored)
- Live analytics: subscribers, views, SEO score per video
- AI generates optimized titles, tags, descriptions (FREE via Google Gemini)
- **One-tap PUBLISH** buttons write changes directly to YouTube

---

## STEP 1 — Get Your Free Gemini API Key (2 minutes)

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google → Click "Create API Key"
3. Copy the key — this powers all AI features, FREE (1,500 requests/day)
4. **No credit card needed, ever**

---

## STEP 2 — Google Cloud OAuth Setup (10 minutes)

### 2.1 Create Project
1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name: `RhinoAlgo YT Engine` → Create

### 2.2 Enable YouTube Data API v3
1. Go to "APIs & Services" → "Library"
2. Search "YouTube Data API v3" → Click → **ENABLE**

### 2.3 Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. First time? Configure consent screen:
   - User Type: **External** → Create
   - App name: `RhinoAlgo YT Engine`
   - Support email: your email
   - Click Save → Scopes: skip → Test users: add your Gmail → Save
4. Back to Credentials → Create OAuth client ID:
   - Application type: **Web application**
   - Name: `RhinoAlgo YT Engine`
   - Authorized redirect URIs — add:
     - `http://localhost:3000/auth/callback`
     - `https://YOUR-APP.vercel.app/auth/callback` (fill after Step 3)
5. Click Create → Copy **Client ID** and **Client Secret**

---

## STEP 3 — Deploy to Vercel (Free, 5 minutes)

### 3.1 Upload to GitHub
1. Go to https://github.com → New repository
2. Name: `rhinoalgo-yt-engine` → Public → Create
3. Upload all files from this ZIP

### 3.2 Deploy on Vercel
1. Go to https://vercel.com → Sign up with GitHub (free)
2. "Add New Project" → Import `rhinoalgo-yt-engine`
3. Click **Deploy** (will fail — need env vars next)

### 3.3 Add Environment Variables
In Vercel → Your Project → Settings → Environment Variables:

| Name | Value | Where to get |
|------|-------|--------------|
| `GOOGLE_CLIENT_ID` | `123456-abc.apps.googleusercontent.com` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Google Cloud Console |
| `GEMINI_API_KEY` | `AIzaSy...` | aistudio.google.com |
| `BASE_URL` | `https://your-app.vercel.app` | Your Vercel URL |
| `SESSION_SECRET` | `rhinoalgo_xyz123abc456` | Make up any random string |

4. Settings → Deployments → **Redeploy**

### 3.4 Add Vercel URL to OAuth
1. Google Cloud Console → Credentials → your OAuth client → Edit
2. Add to Authorized redirect URIs:
   `https://your-app.vercel.app/auth/callback`
3. Save

---

## STEP 4 — Use the App!

1. Open your Vercel URL in Chrome
2. Click **LOGIN WITH GOOGLE**
3. Sign in with your YouTube channel's Google account
4. Allow permissions
5. Your channel loads automatically ✅

---

## How Publish Buttons Work
Each video has 3 publish buttons that update YouTube directly:

- **▶ PUBLISH TITLE TO YOUTUBE** — Updates your video title live
- **▶ PUBLISH TAGS TO YOUTUBE** — Adds AI tags to your video
- **▶ PUBLISH DESCRIPTION TO YOUTUBE** — Updates your video description

Workflow: Generate AI suggestion → Review it → Tap Publish → Done!

---

## Troubleshooting

**"Access blocked: app has not completed verification"**
→ In OAuth consent screen → Test Users → Add your Gmail address

**"redirect_uri_mismatch"**
→ Add `https://your-app.vercel.app/auth/callback` to OAuth authorized URIs

**AI not working**
→ Check GEMINI_API_KEY is correct in Vercel env vars → Redeploy

**Videos not loading**
→ Make sure YouTube Data API v3 is ENABLED in Google Cloud Console

---

## Local Testing
```bash
npm install
cp .env.example .env
# Edit .env — set BASE_URL=http://localhost:3000 and fill credentials
node server/index.js
# Open http://localhost:3000
```
