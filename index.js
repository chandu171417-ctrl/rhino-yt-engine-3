require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'rhinoalgo_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// ─── OAUTH2 CLIENT ────────────────────────────────────────
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BASE_URL || 'http://localhost:3000'}/auth/callback`
  );
}

// ─── AUTH ROUTES ──────────────────────────────────────────

// Start Google OAuth login
app.get('/auth/login', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
  res.redirect(url);
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('/?error=' + encodeURIComponent(error));
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect('/app');
  } catch (e) {
    console.error('OAuth callback error:', e.message);
    res.redirect('/?error=' + encodeURIComponent('Authentication failed: ' + e.message));
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.tokens });
});

// ─── AUTH MIDDLEWARE ──────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated. Please login.' });
  }
  next();
}

function getYoutubeClient(tokens) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return google.youtube({ version: 'v3', auth: oauth2Client });
}

// ─── CHANNEL API ──────────────────────────────────────────

// Get channel info + stats
app.get('/api/channel', requireAuth, async (req, res) => {
  try {
    const yt = getYoutubeClient(req.session.tokens);
    const r = await yt.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings', 'contentDetails'],
      mine: true,
    });
    if (!r.data.items?.length) return res.status(404).json({ error: 'No channel found' });
    res.json(r.data.items[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all videos (up to 50)
app.get('/api/videos', requireAuth, async (req, res) => {
  try {
    const yt = getYoutubeClient(req.session.tokens);

    // Get channel to find uploads playlist
    const chRes = await yt.channels.list({
      part: ['contentDetails'],
      mine: true,
    });
    const uploadsId = chRes.data.items[0].contentDetails.relatedPlaylists.uploads;

    // Get playlist items
    const plRes = await yt.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsId,
      maxResults: 50,
    });

    if (!plRes.data.items?.length) return res.json([]);

    const videoIds = plRes.data.items.map(i => i.contentDetails.videoId).join(',');

    // Get full video details
    const vidRes = await yt.videos.list({
      part: ['snippet', 'statistics', 'contentDetails', 'status'],
      id: [videoIds],
    });

    res.json(vidRes.data.items || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUBLISH ROUTES (Write to YouTube) ───────────────────

// Publish updated title + description + tags to a video
app.post('/api/video/:videoId/publish', requireAuth, async (req, res) => {
  const { videoId } = req.params;
  const { title, description, tags } = req.body;

  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  try {
    const yt = getYoutubeClient(req.session.tokens);

    // First get current snippet to preserve categoryId etc
    const current = await yt.videos.list({
      part: ['snippet'],
      id: [videoId],
    });
    if (!current.data.items?.length) return res.status(404).json({ error: 'Video not found' });

    const currentSnippet = current.data.items[0].snippet;

    // Build updated snippet
    const updatedSnippet = {
      ...currentSnippet,
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(tags !== undefined && { tags }),
    };

    // Push update
    const result = await yt.videos.update({
      part: ['snippet'],
      requestBody: {
        id: videoId,
        snippet: updatedSnippet,
      },
    });

    res.json({ success: true, video: result.data });
  } catch (e) {
    console.error('Publish error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Publish title only
app.post('/api/video/:videoId/publish-title', requireAuth, async (req, res) => {
  const { videoId } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const yt = getYoutubeClient(req.session.tokens);
    const current = await yt.videos.list({ part: ['snippet'], id: [videoId] });
    const snippet = { ...current.data.items[0].snippet, title };
    const result = await yt.videos.update({ part: ['snippet'], requestBody: { id: videoId, snippet } });
    res.json({ success: true, video: result.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Publish tags only
app.post('/api/video/:videoId/publish-tags', requireAuth, async (req, res) => {
  const { videoId } = req.params;
  const { tags } = req.body;
  if (!tags) return res.status(400).json({ error: 'tags required' });
  try {
    const yt = getYoutubeClient(req.session.tokens);
    const current = await yt.videos.list({ part: ['snippet'], id: [videoId] });
    const snippet = { ...current.data.items[0].snippet, tags };
    const result = await yt.videos.update({ part: ['snippet'], requestBody: { id: videoId, snippet } });
    res.json({ success: true, video: result.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Publish description only
app.post('/api/video/:videoId/publish-description', requireAuth, async (req, res) => {
  const { videoId } = req.params;
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });
  try {
    const yt = getYoutubeClient(req.session.tokens);
    const current = await yt.videos.list({ part: ['snippet'], id: [videoId] });
    const snippet = { ...current.data.items[0].snippet, description };
    const result = await yt.videos.update({ part: ['snippet'], requestBody: { id: videoId, snippet } });
    res.json({ success: true, video: result.data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── AI ROUTES (Google Gemini — FREE, 1500 req/day) ─────────

app.post('/api/ai/generate', requireAuth, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in environment variables.' });
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Gemini API error');
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PAGES ────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/app', (req, res) => {
  if (!req.session.tokens) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../public/app.html'));
});

// ─── START ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 RhinoAlgo YT Engine running at http://localhost:${PORT}`);
  console.log(`📺 Open http://localhost:${PORT} in your browser\n`);
});
