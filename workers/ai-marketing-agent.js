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
 *  Admin panel mein iske 4 endpoints use hote hain:
 *   - POST /run-agent            → poora upar wala flow ek baar chalata hai
 *                                    (ab isme SEO-opportunity blog draft bhi
 *                                    auto-ban jaata hai, blog_drafts collection mein)
 *   - POST /traffic-report       → sirf GA4 traffic padh kar turant dikhata hai
 *   - POST /generate-blog-draft  → ek naya blog draft banata hai (khud SEO
 *                                    opportunity keyword chunta hai, ya
 *                                    body.keyword mein diya hua use karta hai)
 *   - POST /list-blog-drafts     → recent blog drafts list karta hai
 *
 *  ⚠️ Blog drafts KABHI khud publish/deploy nahi hote — sirf Firestore
 *  blog_drafts collection mein 'pending_review' status ke saath save hote
 *  hain. Publish karna (naya blog-*.html file banana, blog.html + sitemap.xml
 *  update karna) hamesha ek manual, reviewed step hai.
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
          return json(
            {
              error: 'Sirf admin chala sakta hai',
              debug: {
                hadIdToken: !!body.idToken,
                idTokenLength: body.idToken ? body.idToken.length : 0,
                verifiedOk: verified.ok,
                verifiedReason: verified.reason || null,
                verifiedEmail: verified.email || null,
                expectedAdminEmail: env.ADMIN_EMAIL || null,
                emailsMatch: verified.email === env.ADMIN_EMAIL,
              },
            },
            403,
            cors
          );
        }
        const result = await runAgent(env);
        return json({ ok: true, result }, 200, cors);
      } catch (e) {
        return json({ error: 'Unexpected error: ' + String(e.message || e) }, 500, cors);
      }
    }

    if (url.pathname === '/generate-blog-draft' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const verified = await verifyFirebaseIdToken(body.idToken, env);
        if (!verified.ok || verified.email !== env.ADMIN_EMAIL) {
          return json(
            { error: 'Sirf admin chala sakta hai', debug: debugBlock(body, verified, env) },
            403,
            cors
          );
        }
        const googleToken = await getGoogleAccessToken(env);
        // Agar admin ne khud keyword diya hai (body.keyword) to wahi use karo,
        // warna SEO opportunities mein se sabse zyada impressions waala uthao.
        let opportunity;
        if (body.keyword) {
          opportunity = { query: body.keyword, impressions: null, position: null, ctr: null };
        } else {
          const opportunities = await fetchSeoOpportunities(googleToken, env);
          if (!opportunities.length) {
            return json(
              {
                error:
                  'Abhi koi achhi SEO opportunity keyword nahi mili — kam Search Console data hai. Khud ek keyword daal ke try karo.',
              },
              200,
              cors
            );
          }
          opportunity = opportunities[0];
        }
        const draft = await generateBlogDraft(opportunity, env);
        const docId = `draft_${Date.now()}`;
        const draftDoc = {
          createdAt: new Date().toISOString(),
          status: 'pending_review',
          targetKeyword: opportunity.query,
          seoContext: {
            impressions: opportunity.impressions,
            position: opportunity.position,
            ctr: opportunity.ctr,
          },
          ...draft,
        };
        await saveToFirestore(googleToken, 'blog_drafts', docId, draftDoc, env);
        return json({ ok: true, draft: { id: docId, ...draftDoc } }, 200, cors);
      } catch (e) {
        return json({ error: 'Unexpected error: ' + String(e.message || e) }, 500, cors);
      }
    }

    if (url.pathname === '/list-blog-drafts' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const verified = await verifyFirebaseIdToken(body.idToken, env);
        if (!verified.ok || verified.email !== env.ADMIN_EMAIL) {
          return json(
            { error: 'Sirf admin chala sakta hai', debug: debugBlock(body, verified, env) },
            403,
            cors
          );
        }
        const googleToken = await getGoogleAccessToken(env);
        const drafts = await listFromFirestore(googleToken, 'blog_drafts', env, 10);
        return json({ ok: true, drafts }, 200, cors);
      } catch (e) {
        return json({ error: 'Unexpected error: ' + String(e.message || e) }, 500, cors);
      }
    }

    if (url.pathname === '/traffic-report' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const verified = await verifyFirebaseIdToken(body.idToken, env);
        if (!verified.ok || verified.email !== env.ADMIN_EMAIL) {
          return json(
            {
              error: 'Sirf admin chala sakta hai',
              debug: {
                hadIdToken: !!body.idToken,
                idTokenLength: body.idToken ? body.idToken.length : 0,
                verifiedOk: verified.ok,
                verifiedReason: verified.reason || null,
                verifiedEmail: verified.email || null,
                expectedAdminEmail: env.ADMIN_EMAIL || null,
                emailsMatch: verified.email === env.ADMIN_EMAIL,
              },
            },
            403,
            cors
          );
        }
        const token = await getGoogleAccessToken(env);
        const traffic = await fetchGA4Traffic(token, env);
        return json({ ok: true, traffic }, 200, cors);
      } catch (e) {
        return json({ error: 'Unexpected error: ' + String(e.message || e) }, 500, cors);
      }
    }

    // ── /chat — Real AI Chatbot (public, no auth needed) ───────────
    // Rate limited per IP via CF Worker: max 20 messages / 10 min
    if (url.pathname === '/chat' && request.method === 'POST') {
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      try {
        const body = await request.json().catch(() => ({}));
        const userMsg = (body.message || '').toString().slice(0, 500).trim();
        const history = Array.isArray(body.history) ? body.history.slice(-6) : []; // last 3 turns

        if (!userMsg) {
          return json({ error: 'Message khali nahi ho sakta' }, 400, cors);
        }

        // ── Rate limit: 20 messages per IP per 10 minutes ──────────
        if (env.CHAT_RATE) {
          const ratKey = `chat_rate_${clientIp}`;
          const ratRaw = await env.CHAT_RATE.get(ratKey);
          const count = ratRaw ? parseInt(ratRaw, 10) : 0;
          if (count >= 20) {
            return json(
              {
                reply:
                  '🙏 Aapne bahut saare messages bheje hain. Thodi der baad try karo ya seedha WhatsApp pe baat karo: https://wa.me/917903567007',
              },
              200,
              cors
            );
          }
          await env.CHAT_RATE.put(ratKey, String(count + 1), { expirationTtl: 600 });
        }

        // ── Build system prompt with restaurant context ─────────────
        const systemPrompt = `You are "Atharav Assistant", the friendly AI chatbot for Atharav Kitchen — a cloud kitchen in Dhanbad, Jharkhand, India.

RESTAURANT DETAILS:
- Name: Atharav Kitchen
- Address: 1st Floor, Shastri Nagar, Jain Mandir Road, Near Saroj Apartment, Bank More, Dhanbad, Jharkhand – 826001
- Phone: +91 79035 67007
- WhatsApp: https://wa.me/917903567007
- Timings: Daily 11:00 AM to 3:00 AM (7 days a week)
- FSSAI: 21124172000376

MENU (main categories):
- Indo-Western: Burgers (₹120-180), Wraps (₹110-160), Sandwiches (₹90-140), Fries (₹80-120)
- Chinese: Noodles (₹120-180), Fried Rice (₹130-190), Momos (₹100-160), Chilli Chicken (₹180-220), Manchurian (₹150-200)
- Indian: Butter Chicken (₹220-280), Dal Makhani (₹180-220), Paneer Dishes (₹180-250), Biryani (₹180-250)
- Drinks: Shakes (₹100-150), Cold Coffee (₹80-120), Fresh Juices (₹80-120)

ORDERING:
- Website (this site) — add to cart, checkout via WhatsApp
- Zomato: https://link.zomato.com/xqzv/rshare?id=8966837430563d60
- Swiggy: search "Atharav Kitchen Dhanbad"
- Direct WhatsApp: https://wa.me/917903567007

DELIVERY:
- Delivery charge: ₹30 (FREE on orders ₹399+)
- Estimated time: 30-45 minutes
- Area: approx. 5 km from Bank More, Dhanbad

RULES FOR YOUR RESPONSES:
- Reply in the same language the customer writes in (Hindi/Hinglish/English)
- Be warm, friendly, and concise (2-4 sentences max per reply)
- For order tracking, say "Apna order ID do, main track karta hoon"
- For complaints or refunds, always give WhatsApp number
- NEVER make up menu prices if unsure — say "exact price ke liye menu check karo"
- NEVER promise discounts or offers not mentioned above
- If asked something you don't know, redirect to WhatsApp`;

        // ── Build conversation messages ─────────────────────────────
        const messages = [];
        // Add conversation history
        for (const turn of history) {
          if (turn.role === 'user' || turn.role === 'assistant') {
            messages.push({ role: turn.role, content: String(turn.content).slice(0, 300) });
          }
        }
        // Add current user message
        messages.push({ role: 'user', content: userMsg });

        // ── Call Claude API ─────────────────────────────────────────
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2025-02-19',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', // Fast + cheap for chat
            max_tokens: 300,
            system: systemPrompt,
            messages,
          }),
        });

        if (!claudeRes.ok) {
          const errText = await claudeRes.text().catch(() => '');
          console.error('[AK Chat] Claude API error:', claudeRes.status, errText);
          return json(
            {
              reply: 'Abhi AI temporarily unavailable hai. WhatsApp pe baat karo: +91 79035 67007',
            },
            200,
            cors
          );
        }

        const claudeData = await claudeRes.json();
        const reply =
          claudeData.content && claudeData.content[0] && claudeData.content[0].type === 'text'
            ? claudeData.content[0].text.trim()
            : 'Kuch technical issue aa gaya. WhatsApp try karo: +91 79035 67007';

        return json({ ok: true, reply }, 200, cors);
      } catch (e) {
        console.error('[AK Chat] Error:', e);
        return json(
          { reply: 'Kuch gadbad ho gayi. WhatsApp pe contact karo: https://wa.me/917903567007' },
          200,
          cors
        );
      }
    }

    return json({ error: 'Not found' }, 404, cors);
  },
};

function debugBlock(body, verified, env) {
  return {
    hadIdToken: !!body.idToken,
    idTokenLength: body.idToken ? body.idToken.length : 0,
    verifiedOk: verified.ok,
    verifiedReason: verified.reason || null,
    verifiedEmail: verified.email || null,
    expectedAdminEmail: env.ADMIN_EMAIL || null,
    emailsMatch: verified.email === env.ADMIN_EMAIL,
  };
}

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
      postResults.facebook = await postToFacebook(
        aiOutput.offer_text,
        aiOutput.offer_image_url,
        env
      );
    } catch (e) {
      postResults.facebook = { error: String(e.message || e) };
    }
    if (aiOutput.offer_image_url) {
      try {
        postResults.instagram = await postToInstagram(
          aiOutput.offer_text,
          aiOutput.offer_image_url,
          env
        );
      } catch (e) {
        postResults.instagram = { error: String(e.message || e) };
      }
    }
    log.steps.push('social_posted');
  }

  // Weekly blog draft — sirf DRAFT banta hai (blog_drafts collection mein),
  // kabhi khud publish/deploy nahi hota. Publish karna hamesha admin ka
  // manual decision hai (naya blog-*.html file banana, blog.html mein link
  // add karna, sitemap.xml update karna — ye sab code-deploy steps hain
  // jo review ke bina automate karna risky hai).
  let blogDraftDoc = null;
  try {
    const opportunities = await fetchSeoOpportunities(googleToken, env);
    if (opportunities.length) {
      const topOpportunity = opportunities[0];
      const draft = await generateBlogDraft(topOpportunity, env);
      const draftId = `draft_${Date.now()}`;
      blogDraftDoc = {
        createdAt: new Date().toISOString(),
        status: 'pending_review',
        targetKeyword: topOpportunity.query,
        seoContext: {
          impressions: topOpportunity.impressions,
          position: topOpportunity.position,
          ctr: topOpportunity.ctr,
        },
        ...draft,
      };
      await saveToFirestore(googleToken, 'blog_drafts', draftId, blogDraftDoc, env);
      log.steps.push('blog_draft_saved');
    } else {
      log.steps.push('blog_draft_skipped_no_opportunity');
    }
  } catch (e) {
    log.steps.push('blog_draft_failed: ' + String(e.message || e));
  }

  const reportDoc = {
    createdAt: new Date().toISOString(),
    ga4Summary: ga4Data.summary,
    gscSummary: gscData.summary,
    reportText: aiOutput.report_text,
    offerText: aiOutput.offer_text,
    actionItems: aiOutput.action_items || [],
    postResults,
    blogDraftKeyword: blogDraftDoc ? blogDraftDoc.targetKeyword : null,
  };
  await saveToFirestore(googleToken, 'agent_reports', `report_${Date.now()}`, reportDoc, env);
  log.steps.push('report_saved');

  return { log, reportDoc, blogDraftDoc };
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
      ? {
          users: +rows[0].metricValues[0].value,
          views: +rows[0].metricValues[1].value,
          sessions: +rows[0].metricValues[2].value,
        }
      : { users: 0, views: 0, sessions: 0 },
    lastWeek: rows[1]
      ? {
          users: +rows[1].metricValues[0].value,
          views: +rows[1].metricValues[1].value,
          sessions: +rows[1].metricValues[2].value,
        }
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
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// "SEO opportunity" = query jispe site already kuch dikh rahi hai Google mein
// (isliye impressions mila) lekin achi position pe nahi hai (4-25 rank) —
// matlab ranking improve karne ka real chance hai. Rank 1-3 waali queries
// already achi hain (blog inhi pe nahi likhna), aur bahut kam impressions
// waali queries statistically kam bharosemand hain.
async function fetchSeoOpportunities(token, env) {
  const siteUrl = encodeURIComponent(env.SEARCH_CONSOLE_SITE_URL);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: daysAgo(28),
        endDate: today(),
        dimensions: ['query'],
        rowLimit: 50,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Search Console fetch failed: ' + JSON.stringify(data));

  const rows = data.rows || [];
  return rows
    .map((r) => ({
      query: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: r.position,
    }))
    .filter((r) => r.position >= 4 && r.position <= 25 && r.impressions >= 8)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);
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
      'anthropic-version': '2025-02-19',
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

// Ek SEO-opportunity keyword se poora blog draft banata hai — title, meta
// description, slug, aur HTML body — jo site ke existing blog-*.html posts
// ke exact template/style se match kare. Ye sirf DRAFT hai, koi file khud
// nahi ban jaati — admin panel mein preview/copy hoga, publish tumhare
// haath mein rahega.
async function generateBlogDraft(opportunity, env) {
  const prompt = `Tum Atharav Kitchen (Dhanbad, Jharkhand ka cloud kitchen — Indo-Western, Chinese & Indian food, late-night delivery) ke liye SEO content writer ho.

Target keyword jispe blog likhna hai: "${opportunity.query}"
(Ye keyword Google Search Console mein already impressions le raha hai, position ~${opportunity.position ? Math.round(opportunity.position) : 'unknown'} — matlab improve karne ka real chance hai.)

Existing blog posts ka style: plain English (Hinglish nahi), 800-1000 words, h2/h3 headings, kabhi kabhi bullet list, Dhanbad ke local references (Bank More, Jain Mandir Road), Atharav Kitchen ko naturally mention karna bina overselling ke. Koi fabricated stats/awards mat likhna.

Sirf JSON return karo, koi aur text nahi, is format mein:
{
  "title": "SEO title tag ke liye, 50-60 characters, keyword ke saath",
  "metaDescription": "150-160 characters, keyword ke saath, click-worthy",
  "slug": "url-slug-jaisa-existing-blog-filenames (lowercase-hyphenated, blog- prefix ke bina)",
  "h1": "Page ka H1 heading (title se thoda alag ho sakta hai, zyada natural)",
  "htmlBody": "Poora blog body sirf <p>, <h2>, <h3>, <ul>, <li>, <strong> tags mein — 800-1000 words, koi <html>/<head>/<body> tag nahi, sirf inner content"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2025-02-19',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Claude API failed (blog draft): ' + JSON.stringify(data));

  const text = (data.content || []).map((b) => b.text || '').join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    throw new Error('Claude ne valid JSON nahi diya blog draft ke liye: ' + text.slice(0, 200));
  }
  return parsed;
}

// ============================================================
// 7. FIRESTORE
// ============================================================
// Generic save — kisi bhi collection/docId mein likh sakta hai
// (agent_reports, blog_drafts, dono isi se save hote hain).
async function saveToFirestore(token, collection, docId, docData, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;

  const fields = toFirestoreFields(docData);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Firestore save failed: ' + JSON.stringify(data));
  return data;
}

// Generic list — recent docs ek collection se, newest first.
async function listFromFirestore(token, collection, env, limit) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: limit || 10,
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Firestore list failed: ' + JSON.stringify(data));

  return (data || [])
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document.name.split('/').pop(),
      ...fromFirestoreFields(r.document.fields || {}),
    }));
}

function fromFirestoreFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromFirestoreValue(v);
  return out;
}
function fromFirestoreValue(v) {
  if (v.nullValue !== undefined) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if (v.mapValue !== undefined) return fromFirestoreFields(v.mapValue.fields || {});
  return null;
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
    if (err.code === 190)
      throw new Error('Facebook token expire ho gaya — naya token generate karo');
    if (err.code === 32 || err.code === 341)
      throw new Error('Facebook rate limit — 1 ghante baad try karo');
    if (err.code === 200 || err.code === 10)
      throw new Error('Facebook permission missing: pages_manage_posts chahiye');
    throw new Error(
      `Facebook error (code ${err.code || 'unknown'}): ${err.message || 'Post fail'}`
    );
  }
  return data;
}

async function postToInstagram(message, imageUrl, env) {
  if (!env.IG_BUSINESS_ID || !env.FB_PAGE_ACCESS_TOKEN) {
    return { skipped: 'IG_BUSINESS_ID set nahi — Worker Settings mein daalo' };
  }
  if (!imageUrl) return { skipped: 'IG ke liye image chahiye — is hafte skip' };
  const igId = env.IG_BUSINESS_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;
  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
    method: 'POST',
    body: new URLSearchParams({ image_url: imageUrl, caption: message || '', access_token: token }),
  });
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) {
    const err = createData.error || {};
    if (err.code === 190) throw new Error('IG token expire ho gaya — naya token generate karo');
    if (err.code === 9004) throw new Error('Image URL public nahi hai');
    if (err.code === 36000) throw new Error('IG daily posting limit hit (max 25/day)');
    throw new Error(`IG media error (${err.code}): ${err.message || 'create failed'}`);
  }
  // IG ko media process karne ka time do
  await new Promise((r) => setTimeout(r, 3000));
  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: createData.id, access_token: token }),
  });
  const pubData = await pubRes.json();
  if (!pubRes.ok || pubData.error) {
    const err = pubData.error || {};
    throw new Error(`IG publish error (${err.code}): ${err.message || 'publish failed'}`);
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
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
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
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
