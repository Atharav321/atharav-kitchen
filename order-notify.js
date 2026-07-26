/**
 * ============================================================
 *  ATHARAV KITCHEN — ORDER STATUS PUSH NOTIFICATIONS (Cloudflare Worker)
 * ============================================================
 *
 *  Purpose: Jab admin panel mein order ka status change hota hai
 *  (Confirmed / Preparing / Out for Delivery / Delivered), yeh Worker
 *  customer ke phone/browser pe ek push notification bhejta hai — bina
 *  app khole bhi. WhatsApp message ke saath-saath ek extra channel.
 *
 *  KAISE KAAM KARTA HAI:
 *  - Customer order track karte waqt "🔔 Notification allow karo" button
 *    dabata hai — uska FCM token uske order document mein save hota hai.
 *  - Admin jab order status change karta hai, admin panel yeh Worker
 *    call karta hai us token ke saath.
 *  - Yeh Worker Firebase ke modern FCM v1 API se message bhejta hai —
 *    iske liye ek "Service Account" chahiye (Firebase Console se free
 *    mein milta hai), jisse yeh Worker securely Google se authenticate
 *    hota hai (koi extra paid service nahi).
 *
 *  DEPLOY KARNE KA TAREEKA (ek baar karna hai):
 *  1. Firebase Console → Project Settings (⚙️) → Service Accounts tab →
 *     "Generate new private key" → ek JSON file download hogi.
 *  2. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *  3. Is poori file ko paste karo Worker editor mein, Deploy dabao
 *  4. Worker → Settings → Variables mein ye add karo:
 *       ADMIN_EMAIL                = chotugupta7395@gmail.com
 *       FIREBASE_API_KEY           = firebase-config.js wali apiKey
 *       ALLOWED_ORIGIN             = https://atharav-kitchen.pages.dev
 *       FIREBASE_SERVICE_ACCOUNT_JSON = (poori downloaded JSON file ki
 *                                        content, ek line mein paste karo
 *                                        "Encrypt" option ke saath)
 *  5. Worker ka URL copy karke admin.html ke Site Settings → "Push
 *     Notifications" card mein daal do.
 * ============================================================
 */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
    if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON secret missing — Worker Settings mein add karo (see file comment).' }, 500, cors);
    }

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON body' }, 400, cors); }

    const { idToken, fcmToken, title, message, orderId } = body;
    if (!idToken) return json({ error: 'Login session missing.' }, 401, cors);
    if (!fcmToken) return json({ error: 'Customer ka notification token missing hai.' }, 400, cors);

    const auth = await verifyFirebaseIdToken(idToken, env);
    if (!auth.ok) return json({ error: 'Login verify nahi hua: ' + auth.reason }, 401, cors);
    if (env.ADMIN_EMAIL && auth.email !== env.ADMIN_EMAIL) {
      return json({ error: 'Sirf admin hi notification bhej sakta hai.' }, 403, cors);
    }

    try {
      const accessToken = await getGoogleAccessToken(env);
      const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title: title || 'Atharav Kitchen', body: message || '' },
            webpush: {
              notification: { icon: 'https://atharav-kitchen.pages.dev/icon-192.webp' },
              fcm_options: { link: 'https://atharav-kitchen.pages.dev/' },
            },
            data: { orderId: String(orderId || '') },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) return json({ error: 'FCM error: ' + JSON.stringify(data) }, 500, cors);
      return json({ ok: true }, 200, cors);
    } catch (e) {
      return json({ error: 'Notification send fail hua: ' + String(e.message || e) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

async function verifyFirebaseIdToken(idToken, env) {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const data = await res.json();
    if (!res.ok || !data.users || !data.users.length) return { ok: false, reason: 'Token invalid or expired' };
    return { ok: true, email: data.users[0].email };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  }
}

// Sign a service-account JWT and exchange it for a short-lived Google
// OAuth2 access token, so we can call the modern FCM v1 send API
// (the old legacy server-key API has been retired by Google).
async function getGoogleAccessToken(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = enc(header) + '.' + enc(claimSet);
  const key = await importPrivateKey(sa.private_key);
  const sigBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = unsigned + '.' + base64UrlFromArrayBuffer(sigBuffer);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' +
      encodeURIComponent(jwt),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Google auth token exchange failed: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64UrlFromArrayBuffer(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
