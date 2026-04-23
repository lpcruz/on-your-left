/**
 * Strava OAuth helper — run once to get a refresh token, then reuse forever.
 *
 * Usage: npm run strava:auth
 *
 * Opens the Strava authorization page in your browser, waits for the callback
 * on localhost:4000, exchanges the code for tokens, and writes STRAVA_REFRESH_TOKEN
 * to backend/.env automatically.
 */
import 'dotenv/config';
import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../../.env');

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:4000/callback';
const SCOPE         = 'read,activity:read';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const authUrl =
  `https://www.strava.com/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&approval_prompt=force` +
  `&scope=${SCOPE}`;

console.log('\n🔐 Opening Strava authorization in your browser...');
console.log('   If it doesn\'t open automatically, visit:\n');
console.log(`   ${authUrl}\n`);

exec(`open "${authUrl}"`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:4000');
  if (url.pathname !== '/callback') return;

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>Authorization denied. You can close this tab.</h2>');
    console.error('❌ Authorization denied:', error);
    server.close();
    process.exit(1);
  }

  try {
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

    const tokens = await tokenRes.json();

    if (!tokens.refresh_token) {
      throw new Error(tokens.message || 'No refresh token returned');
    }

    // Write refresh token back into .env
    let envContents = readFileSync(ENV_PATH, 'utf8');
    if (envContents.includes('STRAVA_REFRESH_TOKEN=')) {
      envContents = envContents.replace(
        /STRAVA_REFRESH_TOKEN=.*/,
        `STRAVA_REFRESH_TOKEN=${tokens.refresh_token}`
      );
    } else {
      envContents += `\nSTRAVA_REFRESH_TOKEN=${tokens.refresh_token}`;
    }
    writeFileSync(ENV_PATH, envContents);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body style="font-family:sans-serif;padding:2rem;text-align:center">
        <h2>✅ Authorization successful!</h2>
        <p>Refresh token saved to <code>.env</code>. You can close this tab.</p>
        <p>Now run: <code>npm run strava:sync</code></p>
      </body></html>
    `);

    console.log('✅ Refresh token saved to .env');
    console.log(`   Athlete: ${tokens.athlete?.firstname} ${tokens.athlete?.lastname}`);
    console.log('\n   Now run: npm run strava:sync\n');

    server.close();
  } catch (err) {
    console.error('❌ Token exchange failed:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Token exchange failed: ' + err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(4000, '127.0.0.1', () => {
  console.log('   Waiting for Strava callback on http://localhost:4000/callback...\n');
});
