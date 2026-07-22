/**
 * ============================================================
 *  ATHARAV KITCHEN — SOCIAL MEDIA POSTER (Cloudflare Worker)
 * ============================================================
 *
 *  Purpose: Admin panel se ek button dabate hi Facebook Page aur
 *  Instagram Business account par post chala jaye — automatically.
 *
 *  SECURITY DESIGN (important — isliye secure hai):
 *  - Facebook/Instagram ka "Access Token" sirf yahan, Cloudflare ke
 *    encrypted SECRET store mein rehta hai. Kabhi bhi browser ko
 *    (admin.html ko) nahi bheja jata, kabhi GitHub mein commit nahi
 *    hota. Isse koi bhi website source dekh ke token chura nahi
 *    sakta.
 *  - Har request pe hum admin ka Firebase login token (idToken)
 *    verify karte hain seedha Google/Firebase se — sirf tumhara
 *    (chotugupta7395@gmail.com) admin account hi post kar sakta hai,
 *    koi aur nahi, chahe wo admin.html ka URL bhi jaanta ho.
 *  - CORS sirf tumhare apne domain se allow hai.
 *
 *  DEPLOY KARNE KA TAREEKA (ek baar karna hai):
 *  1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *  2. Is poori file ko paste karo Worker editor mein, Deploy dabao
 *  3. Worker ke "Settings → Variables" mein ye SECRETS add karo
 *     (encrypted rahenge, koi dekh nahi payega baad mein):
 *       FB_PAGE_ACCESS_TOKEN   = tumhara Facebook Page access token
 *       FB_PAGE_ID             = tumhara Facebook Page ID
 *       IG_BUSINESS_ID         = tumhara Instagram Business Account ID
 *       ADMIN_EMAIL            = chotugupta7395@gmail.com
 *       FIREBASE_API_KEY       = firebase-config.js wali apiKey
 *       ALLOWED_ORIGIN         = https://atharav-kitchen.pages.dev
 *  4. Worker ka URL (jaise https://atharav-social.yourname.workers.dev)
 *     copy karke admin.html mein SOCIAL_WORKER_URL variable mein daalo
 * ============================================================
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body' }, 400, cors);
    }

    const { idToken, message, imageUrl, platforms } = body;
    if (!idToken) return json({ error: 'Missing idToken — admin login required' }, 401, cors);
    if (!message && !imageUrl) return json({ error: 'Message ya imageUrl chahiye' }, 400, cors);

    // ── 1. Verify the caller is really the logged-in admin ──
    const verified = await verifyFirebaseIdToken(idToken, env);
    if (!verified.ok) return json({ error: 'Auth failed: ' + verified.reason }, 401, cors);
    if (verified.email !== env.ADMIN_EMAIL) {
      return json({ error: 'Sirf admin account post kar sakta hai' }, 403, cors);
    }

    // ── 2. Post to whichever platforms were requested ──
    const results = {};
    const wantFB = !platforms || platforms.includes('facebook');
    const wantIG = !platforms || platforms.includes('instagram');

    if (wantFB) {
      try {
        results.facebook = await postToFacebook(message, imageUrl, env);
      } catch (e) {
        results.facebook = { error: String(e.message || e) };
      }
    }
    if (wantIG) {
      try {
        results.instagram = await postToInstagram(message, imageUrl, env);
      } catch (e) {
        results.instagram = { error: String(e.message || e) };
      }
    }

    return json({ ok: true, results }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// Verifies a Firebase Auth ID token by asking Google directly —
// no crypto library needed, and the FB/IG token is never exposed.
async function verifyFirebaseIdToken(idToken, env) {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.users || !data.users.length) {
      return { ok: false, reason: 'Token invalid or expired' };
    }
    return { ok: true, email: data.users[0].email };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  }
}

async function postToFacebook(message, imageUrl, env) {
  const pageId = env.FB_PAGE_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;
  const url = imageUrl
    ? `https://graph.facebook.com/v19.0/${pageId}/photos`
    : `https://graph.facebook.com/v19.0/${pageId}/feed`;
  const params = new URLSearchParams();
  if (imageUrl) {
    params.set('url', imageUrl);
    params.set('caption', message || '');
  } else {
    params.set('message', message || '');
  }
  params.set('access_token', token);

  const res = await fetch(url, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ? data.error.message : 'Facebook post failed');
  return data;
}

async function postToInstagram(message, imageUrl, env) {
  if (!imageUrl) throw new Error('Instagram ke liye image zaroori hai (text-only post nahi ho sakti)');
  const igId = env.IG_BUSINESS_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;

  // Step 1: create a media container
  const createRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
    method: 'POST',
    body: new URLSearchParams({
      image_url: imageUrl,
      caption: message || '',
      access_token: token,
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) {
    throw new Error(createData.error ? createData.error.message : 'IG media create failed');
  }

  // Step 2: publish it
  const pubRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({
      creation_id: createData.id,
      access_token: token,
    }),
  });
  const pubData = await pubRes.json();
  if (!pubRes.ok || pubData.error) {
    throw new Error(pubData.error ? pubData.error.message : 'IG publish failed');
  }
  return pubData;
}
