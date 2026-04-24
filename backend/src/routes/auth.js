/**
 * Strava OAuth for end-users.
 * Scope: read + activity:read_all + activity:write
 *   - activity:read_all  → needed for Phase 2 webhook activity fetch
 *   - activity:write     → needed for Phase 3 auto-description
 *
 * Flow:
 *   GET /auth/strava          → redirect to Strava consent page
 *   GET /auth/strava/callback → exchange code, upsert user, set JWT cookie
 *   GET /auth/me              → return current user from JWT
 *   POST /auth/logout         → clear cookie
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import supabase from '../db/client.js';

const router = Router();

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const JWT_SECRET    = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-prod';
const FRONTEND_URL  = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const API_BASE      = process.env.API_BASE ?? 'http://localhost:3001';

// Strava requires activity:read_all for webhook-delivered activities
const SCOPE = 'read,activity:read_all,activity:write';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// ── GET /auth/strava ──────────────────────────────────────────────────────────
router.get('/strava', (req, res) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'Strava not configured' });

  const redirectUri = `${API_BASE}/auth/strava/callback`;
  const url =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&approval_prompt=auto` +
    `&scope=${encodeURIComponent(SCOPE)}`;

  res.redirect(url);
});

// ── GET /auth/strava/callback ─────────────────────────────────────────────────
router.get('/strava/callback', async (req, res) => {
  const { code, error, scope } = req.query;

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}?auth=denied`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Strava token exchange failed:', tokenData);
      return res.redirect(`${FRONTEND_URL}?auth=error`);
    }

    const athlete = tokenData.athlete;

    // Upsert user in DB
    const { data: user, error: dbErr } = await supabase
      .from('users')
      .upsert(
        {
          strava_athlete_id: athlete.id,
          name:             `${athlete.firstname} ${athlete.lastname}`,
          firstname:        athlete.firstname,
          lastname:         athlete.lastname,
          profile_photo:    athlete.profile_medium ?? athlete.profile,
          city:             athlete.city,
          state:            athlete.state,
          country:          athlete.country,
          access_token:     tokenData.access_token,
          refresh_token:    tokenData.refresh_token,
          token_expires_at: tokenData.expires_at,
          scope:            scope ?? SCOPE,
          last_login_at:    new Date().toISOString(),
        },
        { onConflict: 'strava_athlete_id', ignoreDuplicates: false }
      )
      .select('id, strava_athlete_id, name, firstname, profile_photo, city, state')
      .single();

    if (dbErr) {
      console.error('DB upsert failed:', dbErr.message);
      return res.redirect(`${FRONTEND_URL}?auth=error`);
    }

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, athleteId: user.strava_athlete_id, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.cookie('oyl_session', token, COOKIE_OPTS);
    res.redirect(`${FRONTEND_URL}/profile?auth=success`);
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.redirect(`${FRONTEND_URL}?auth=error`);
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const token = req.cookies?.oyl_session;
  if (!token) return res.status(401).json({ user: null });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, strava_athlete_id, name, firstname, lastname, profile_photo, city, state, country, last_login_at')
      .eq('id', payload.userId)
      .single();

    if (error || !user) return res.status(401).json({ user: null });

    res.json({ user });
  } catch {
    res.status(401).json({ user: null });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('oyl_session', { ...COOKIE_OPTS, maxAge: 0 });
  res.json({ ok: true });
});

export default router;
