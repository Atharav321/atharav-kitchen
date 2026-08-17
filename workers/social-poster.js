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
  if (!env.FB_PAGE_ID || !env.FB_PAGE_ACCESS_TOKEN) {
    return { skipped: 'FB_PAGE_ID ya FB_PAGE_ACCESS_TOKEN set nahi — Worker Settings mein daalo' };
  }
  const pageId = env.FB_PAGE_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;
  const url = imageUrl
    ? `https://graph.facebook.com/v21.0/${pageId}/photos`
    : `https://graph.facebook.com/v21.0/${pageId}/feed`;
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
  if (!res.ok || data.error) {
    const err = data.error || {};
    // Specific actionable messages for common FB errors
    if (err.code === 190)
      throw new Error(
        'Facebook token expire ho gaya — Meta Business Suite se naya token generate karo (Settings → Advanced → Page Access Tokens)'
      );
    if (err.code === 32 || err.code === 341)
      throw new Error('Facebook rate limit aa gaya — 1 ghante baad dobara try karo');
    if (err.code === 200 || err.code === 10)
      throw new Error(
        'Facebook permission missing — token mein pages_manage_posts permission chahiye'
      );
    throw new Error(
      `Facebook error (code ${err.code || 'unknown'}): ${err.message || 'Post fail ho gaya'}`
    );
  }
  return data;
}

async function postToInstagram(message, imageUrl, env) {
  if (!env.IG_BUSINESS_ID || !env.FB_PAGE_ACCESS_TOKEN) {
    return {
      skipped: 'IG_BUSINESS_ID ya FB_PAGE_ACCESS_TOKEN set nahi — Worker Settings mein daalo',
    };
  }
  if (!imageUrl)
    throw new Error(
      'Instagram ke liye public image URL chahiye (text-only post nahi ho sakti). Banner pehle banao aur upload karo.'
    );
  const igId = env.IG_BUSINESS_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;

  // Step 1: create a media container
  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
    method: 'POST',
    body: new URLSearchParams({
      image_url: imageUrl,
      caption: message || '',
      access_token: token,
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) {
    const err = createData.error || {};
    if (err.code === 190)
      throw new Error('Instagram token expire ho gaya — Meta Business Suite se naya token lo');
    if (err.code === 9004)
      throw new Error(
        'Image URL public nahi hai — sirf Firebase Storage ke public URLs kaam karte hain'
      );
    if (err.code === 36000)
      throw new Error(
        'Instagram posting limit hit — kal dobara try karo (max 25 posts/day allowed hain)'
      );
    throw new Error(
      `IG media error (code ${err.code || 'unknown'}): ${err.message || 'Media create fail'}`
    );
  }

  // Step 2: publish it — sometimes IG needs a few seconds to process
  await new Promise((r) => setTimeout(r, 3000));
  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({
      creation_id: createData.id,
      access_token: token,
    }),
  });
  const pubData = await pubRes.json();
  if (!pubRes.ok || pubData.error) {
    const err = pubData.error || {};
    throw new Error(
      `IG publish error (code ${err.code || 'unknown'}): ${err.message || 'Publish fail'}`
    );
  }
  return pubData;
}
