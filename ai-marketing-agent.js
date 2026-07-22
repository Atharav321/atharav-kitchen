/**
 * ============================================================
 *  ATHARAV KITCHEN — AI MARKETING AGENT (Cloudflare Worker)
 * ============================================================
 *
 *  Purpose: Har Monday subah (ya jab bhi "Agent Abhi Chalao" dabao)
 *  yeh Worker khud:
 *   1. GA4 se pichle 7 din ka website traffic padhta hai
 *   2. Google Search Console se top search queries padhta hai
 *   3. Claude ko yeh data deke ek Hinglish report + naya
 *      offer/promo text likhwata hai
 *   4. Agar Facebook/Instagram tokens set hain, offer ko seedha
 *      post kar deta hai
 *   5. Poori report Firestore (`agent_reports` collection) mein
 *      save kar deta hai, taaki admin panel usko dikha sake
 *
 *  Admin panel mein iske 2 endpoints use hote hain:
 *   - POST /run-agent       → poora upar wala flow ek baar chalata hai
 *   - POST /traffic-report  → sirf GA4 traffic padh kar turant dikhata hai
 *
 *  DEPLOY KARNE KA TAREEKA (ek baar karna hai):
 *  1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *  2. Is poori file ko paste karo Worker editor mein, Deploy dabao
 *  3. Worker → Settings → Variables and Secrets mein yeh sab add karo
 *     (jo bhi "secret" likha hai use "Encrypt" karke daalo):
 *
 *       ADMIN_EMAIL                  = chotugupta7395@gmail.com
 *       ALLOWED_ORIGIN               = https://atharav-kitchen.pages.dev
 *       FIREBASE_API_KEY             = firebase-config.js wali apiKey
 *       FIREBASE_PROJECT_ID          = atharav-kitchen-e587b
 *       GA4_PROPERTY_ID              = GA4 → Admin → Property Details
 *                                      mein "Property ID" (sirf number, jaise 123456789)
 *       SEARCH_CONSOLE_SITE_URL      = https://atharav-kitchen.pages.dev/
 *       ANTHROPIC_API_KEY (secret)   = console.anthropic.com se API key
 *       GOOGLE_SERVICE_ACCOUNT_JSON  = neeche step 4 dekho (secret)
 *       FB_PAGE_ID (optional)        = Facebook Page ki ID
 *       FB_PAGE_ACCESS_TOKEN (opt.)  = Facebook Page access token (secret)
 *       IG_BUSINESS_ID (optional)    = Instagram Business account ID
 *
 *  4. GOOGLE_SERVICE_ACCOUNT_JSON kahan se milega:
 *     - Google Cloud Console → IAM & Admin → Service Accounts
 *     - Naya service account banao (ya jo pehle se bana hai use karo),
 *       usko in 2 jagah "Viewer"/access role do:
 *         a) Google Analytics (GA4) property mein "Viewer" ke roop mein add karo
 *         b) Search Console property mein "Full user"/"Restricted" access do
 *         c) Firestore/Firebase project mein "Cloud Datastore User" role do
 *     - Phir "Keys" tab → "Add Key" → JSON → download hogi
 *     - Poori JSON file ki content (ek line mein) copy karke
 *       GOOGLE_SERVICE_ACCOUNT_JSON secret mein paste karo
 *     - ⚠️ Yeh JSON file kabhi bhi kisi ke saath share mat karna,
 *       kisi zip mein mat rakhna, sirf Worker ke encrypted secret mein daalo
 *
 *  5. (Optional) Har Monday subah automatically chalane ke liye:
 *     Worker → Settings → Triggers → Cron Triggers → Add:
 *       0 3 * * 1   (matlab: har Monday raat 3 baje UTC = subah IST)
 *
 *  6. Worker ka URL copy karke admin.html ke "Reports & Analytics" →
 *     "AI Marketing Agent" card mein daal do.
 * ============================================================
 */

// ============================================================
// 1. ENTRY POINTS
// ============================================================
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAgent(env));
  },

  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname === '/run-agent' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const verified = await verifyFirebaseIdToken(body.idToken, env);
        // Agar admin check fail ho to detail bhejo (troubleshooting ke liye helpful)
        if (!verified.ok || verified.email !== env.ADMIN_EMAIL) {
          return json({
            error: 'Sirf admin chala sakta hai',
            debug: {
              hadIdToken: !!body.idToken,
              idTokenLength: body.idToken ? body.idToken.length : 0,
              verifiedOk: verified.ok,
              verifiedReason: verified.reason || null,
              verifiedEmail: verified.email || null,
              expectedAdminEmail: env.ADMIN_EMAIL || null,
              emailsMatch: verified.email === env.ADMIN_EMAIL,
            }
          }, 403, cors);
        }
        const result = await runAgent(env);
        return json({ ok: true, result }, 200, cors);
      } catch (e) {
        return json({ error: 'Unexpected error: ' + String(e.message || e) }, 500, cors);
      }
    }

    if (url.pathname === '/traffic-report' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const verified = await verifyFirebaseIdToken(body.idToken, env);
        if (!verified.ok || verified.email !== env.ADMIN_EMAIL) {
          return json({
            error: 'Sirf admin chala sakta hai',
            debug: {
              hadIdToken: !!body.idToken,
              idTokenLength: body.idToken ? body.idToken.length : 0,
              verifiedOk: verified.ok,
              verifiedReason: verified.reason || null,
              verifiedEmail: verified.email || null,
              expectedAdminEmail: env.ADMIN_EMAIL || null,
              emailsMatch: verified.email === env.ADMIN_EMAIL,
            }
          }, 403, cors);
        }
        const token = await getGoogleAccessToken(env);
        const traffic = await fetchGA4Traffic(token, env);
        return json({ ok: true, traffic }, 200, cors);
      } catch (e) {
        return json({ error: 'Unexpected error: ' + String(e.message || e) }, 500, cors);
      }
    }

    return json({ error: 'Not found' }, 404, cors);
  },
};

// ============================================================
// 2. MAIN AGENT LOGIC
// ============================================================
async function runAgent(env) {
  const log = { steps: [] };
  const googleToken = await getGoogleAccessToken(env);
  log.steps.push('google_auth_ok');
  const ga4Data = await fetchGA4Report(googleToken, env);
  log.steps.push('ga4_fetched');
  const gscData = await fetchSearchConsoleReport(googleToken, env);
  log.steps.push('gsc_fetched');
  const aiOutput = await generateReportAndOffer({ ga4Data, gscData, env });
  log.steps.push('ai_generated');

  let postResults = null;
  if (aiOutput.offer_text) {
    postResults = { facebook: null, instagram: null };
    try {
      postResults.facebook = await postToFacebook(aiOutput.offer_text, aiOutput.offer_image_url, env);
    } catch (e) {
      postResults.facebook = { error: String(e.message || e) };
    }
    if (aiOutput.offer_image_url) {
      try {
        postResults.instagram = await postToInstagram(aiOutput.offer_text, aiOutput.offer_image_url, env);
      } catch (e) {
        postResults.instagram = { error: String(e.message || e) };
      }
    }
    log.steps.push('social_posted');
  }

  const reportDoc = {
    createdAt: new Date().toISOString(),
    ga4Summary: ga4Data.summary,
    gscSummary: gscData.summary,
    reportText: aiOutput.report_text,
    offerText: aiOutput.offer_text,
    actionItems: aiOutput.action_items || [],
    postResults,
  };
  await saveReportToFirestore(googleToken, reportDoc, env);
  log.steps.push('report_saved');

  return { log, reportDoc };
}

// ============================================================
// 3. GOOGLE AUTH
// ============================================================
async function getGoogleAccessToken(env) {
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const scopes = [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/datastore',
  ].join(' ');

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: scopes,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj) => base64url(JSON.stringify(obj));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const signature = await signRS256(unsigned, sa.private_key);
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error('Google auth failed: ' + JSON.stringify(data));
  }
  return data.access_token;
}

function base64url(input) {
  const bytes = new TextEncoder().encode(input);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signRS256(data, pem) {
  const key = await importPrivateKey(pem);
  const sigBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data)
  );
  const bytes = new Uint8Array(sigBuffer);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(pemContents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// ============================================================
// 4. GA4 DATA API
// ============================================================
async function fetchGA4Report(token, env) {
  const propertyId = env.GA4_PROPERTY_ID;
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        limit: 10,
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('GA4 fetch failed: ' + JSON.stringify(data));

  const rows = data.rows || [];
  const summary = rows.map((r) => ({
    page: r.dimensionValues[0].value,
    users: r.metricValues[0].value,
    views: r.metricValues[1].value,
    avgDuration: r.metricValues[2].value,
    bounceRate: r.metricValues[3].value,
  }));
  return { raw: data, summary };
}

async function fetchGA4Traffic(token, env) {
  const propertyId = env.GA4_PROPERTY_ID;
  const run = async (body) => {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error('GA4 fetch failed: ' + JSON.stringify(data));
    return data;
  };

  const hourlyRaw = await run({
    dateRanges: [{ startDate: 'today', endDate: 'today' }],
    dimensions: [{ name: 'hour' }],
    metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
    orderBys: [{ dimension: { dimensionName: 'hour' } }],
  });
  const hourly = (hourlyRaw.rows || []).map((r) => ({
    hour: parseInt(r.dimensionValues[0].value, 10),
    users: parseInt(r.metricValues[0].value, 10),
    views: parseInt(r.metricValues[1].value, 10),
  }));

  const dailyRaw = await run({
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  });
  const daily = (dailyRaw.rows || []).map((r) => ({
    date: r.dimensionValues[0].value,
    users: parseInt(r.metricValues[0].value, 10),
    views: parseInt(r.metricValues[1].value, 10),
    sessions: parseInt(r.metricValues[2].value, 10),
  }));

  const thisWeekRaw = await run({
    dateRanges: [
      { startDate: '7daysAgo', endDate: 'today' },
      { startDate: '14daysAgo', endDate: '8daysAgo' },
    ],
    metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
  });
  const rows = thisWeekRaw.rows || [];
  const weekCompare = {
    thisWeek: rows[0]
      ? { users: +rows[0].metricValues[0].value, views: +rows[0].metricValues[1].value, sessions: +rows[0].metricValues[2].value }
      : { users: 0, views: 0, sessions: 0 },
    lastWeek: rows[1]
      ? { users: +rows[1].metricValues[0].value, views: +rows[1].metricValues[1].value, sessions: +rows[1].metricValues[2].value }
      : { users: 0, views: 0, sessions: 0 },
  };

  return { hourly, daily, weekCompare };
}

// ============================================================
// 5. SEARCH CONSOLE API
// ============================================================
async function fetchSearchConsoleReport(token, env) {
  const siteUrl = encodeURIComponent(env.SEARCH_CONSOLE_SITE_URL);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: sevenDaysAgo(),
        endDate: today(),
        dimensions: ['query'],
        rowLimit: 15,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Search Console fetch failed: ' + JSON.stringify(data));

  const rows = data.rows || [];
  const summary = rows.map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
  return { raw: data, summary };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 6. CLAUDE
// ============================================================
async function generateReportAndOffer({ ga4Data, gscData, env }) {
  const prompt = `Tum Atharav Kitchen (Dhanbad, Jharkhand ka cloud kitchen) ke liye marketing assistant ho.

Pichle 7 din ka website data:
GA4 (top pages by views): ${JSON.stringify(ga4Data.summary)}
Search Console (top search queries): ${JSON.stringify(gscData.summary)}

Business context: Late-night cloud kitchen (10 PM - 4 AM bhi khula), Zomato/Swiggy + apni website + WhatsApp order leta hai, target audience Dhanbad ke local log hain.

Sirf JSON return karo, koi aur text nahi, is format mein:
{
  "report_text": "Hinglish mein 4-5 lines ka simple report — is hafte kya accha hua, kya chinta ki baat hai",
  "action_items": ["is hafte ye 3 kaam karo (insaan ke liye, jaise 'Google Business Profile pe 5 photo daalo')"],
  "offer_text": "Ek naya, catchy offer/promo text Hindi-English mix mein, Facebook/Instagram post ke liye, emoji ke saath, 3-4 lines"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Claude API failed: ' + JSON.stringify(data));

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    parsed = { report_text: text, action_items: [], offer_text: null };
  }
  return parsed;
}

// ============================================================
// 7. FIRESTORE
// ============================================================
async function saveReportToFirestore(token, reportDoc, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const docId = `report_${Date.now()}`;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/agent_reports/${docId}`;

  const fields = toFirestoreFields(reportDoc);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Firestore save failed: ' + JSON.stringify(data));
  return data;
}

function toFirestoreFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = toFirestoreValue(v);
  }
  return out;
}
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

// ============================================================
// 8. FACEBOOK / INSTAGRAM POSTING
// ============================================================
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
  if (!imageUrl) return { skipped: 'IG ke liye image chahiye — is hafte skip' };
  const igId = env.IG_BUSINESS_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;

  const createRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
    method: 'POST',
    body: new URLSearchParams({ image_url: imageUrl, caption: message || '', access_token: token }),
  });
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) {
    throw new Error(createData.error ? createData.error.message : 'IG media create failed');
  }
  const pubRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: createData.id, access_token: token }),
  });
  const pubData = await pubRes.json();
  if (!pubRes.ok || pubData.error) {
    throw new Error(pubData.error ? pubData.error.message : 'IG publish failed');
  }
  return pubData;
}

// ============================================================
// 9. FIREBASE ADMIN CHECK — reason bhi return karta hai (troubleshooting ke liye)
// ============================================================
async function verifyFirebaseIdToken(idToken, env) {
  if (!idToken) return { ok: false, reason: 'No token sent from browser' };
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const data = await res.json();
    if (!res.ok || !data.users || !data.users.length) {
      return { ok: false, reason: 'Google rejected token: ' + JSON.stringify(data) };
    }
    return { ok: true, email: data.users[0].email };
  } catch (e) {
    return { ok: false, reason: 'Exception: ' + String(e.message || e) };
  }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}
