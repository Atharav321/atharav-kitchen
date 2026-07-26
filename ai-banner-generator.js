/**
 * ============================================================
 *  ATHARAV KITCHEN — AI BANNER / POSTER GENERATOR (Cloudflare Worker)
 * ============================================================
 *
 *  Purpose: Admin panel ke Marketing section mein ek text prompt
 *  likh kar ("Peri Peri Burger ka festive Diwali poster banao,
 *  orange aur gold colors ke saath") ek professional-looking
 *  banner/poster image generate karta hai — AI se, seedha admin
 *  panel ke andar. Koi Photoshop/Canva ki zaroorat nahi.
 *
 *  KAISE KAAM KARTA HAI:
 *  - Yeh Worker Cloudflare Workers AI ka istemal karta hai — ek
 *    text-to-image model (Stable Diffusion / FLUX). Cloudflare
 *    account ke free tier mein har din hazaaron images free milti
 *    hain, koi alag OpenAI/DALL-E key nahi chahiye.
 *  - Har request pe admin ka Firebase login token (idToken) verify
 *    hota hai seedha Google/Firebase se — sirf tumhara
 *    (chotugupta7395@gmail.com) admin account hi image generate
 *    kar sakta hai, koi aur nahi.
 *  - CORS sirf tumhare apne domain se allow hai.
 *
 *  DEPLOY KARNE KA TAREEKA (ek baar karna hai):
 *  1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *  2. Is poori file ko paste karo Worker editor mein, Deploy dabao
 *  3. Worker ke naam pe click karo → Settings → Bindings →
 *     "Add binding" → Type: "Workers AI" → Variable name: AI → Save
 *     (Yeh bilkul FREE hai, Cloudflare ke free plan mein bhi milta hai)
 *  4. Worker ke "Settings → Variables" mein ye add karo:
 *       ADMIN_EMAIL      = chotugupta7395@gmail.com
 *       FIREBASE_API_KEY = firebase-config.js wali apiKey
 *       ALLOWED_ORIGIN   = https://atharav-kitchen.pages.dev
 *  5. Worker ka URL (jaise https://atharav-ai-banner.yourname.workers.dev)
 *     copy karke admin.html ke Marketing section mein "AI Banner
 *     Generator" card ke Worker URL box mein daalo.
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
    if (!env.AI) {
      return json({ error: 'Workers AI binding missing. Worker Settings → Bindings mein "AI" binding add karo (see file comment).' }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body' }, 400, cors);
    }

    const { idToken, prompt, style, aspect } = body;
    if (!idToken) return json({ error: 'Login session missing — dubara admin login karo.' }, 401, cors);
    if (!prompt || !prompt.trim()) return json({ error: 'Prompt khali hai — kya banana hai batao.' }, 400, cors);

    const auth = await verifyFirebaseIdToken(idToken, env);
    if (!auth.ok) return json({ error: 'Login verify nahi hua: ' + auth.reason }, 401, cors);
    if (env.ADMIN_EMAIL && auth.email !== env.ADMIN_EMAIL) {
      return json({ error: 'Sirf admin account hi banner generate kar sakta hai.' }, 403, cors);
    }

    // Build a food-marketing-tuned prompt so results look like a real poster,
    // not a random AI image.
    const stylePreset = {
      festive: 'festive Indian festival themed food poster, warm string lights, marigold flowers, gold and red accents',
      minimal: 'clean minimal modern food poster, soft studio lighting, lots of negative space, premium restaurant branding',
      bold: 'bold vibrant street-food poster, high contrast, punchy colors, dynamic diagonal composition',
      discount: 'eye-catching discount/sale food poster, bright orange and yellow burst shapes, big bold sale typography',
    }[style] || 'professional appetizing food advertisement poster, warm inviting lighting';

    const aspectSize = {
      square: { width: 1024, height: 1024 },
      story: { width: 768, height: 1344 },
      landscape: { width: 1344, height: 768 },
    }[aspect] || { width: 1024, height: 1024 };

    const finalPrompt =
      `${prompt.trim()}. ${stylePreset}. Professional food photography and graphic design, ` +
      `appetizing, high detail, restaurant marketing banner, no watermark, no text errors.`;

    try {
      const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
        prompt: finalPrompt,
        width: aspectSize.width,
        height: aspectSize.height,
      });

      // Workers AI's flux-1-schnell returns { image: base64PNG }
      const imageBase64 = result && result.image ? result.image : null;
      if (!imageBase64) return json({ error: 'AI model se image nahi mili, dubara try karo.' }, 500, cors);

      return json({ ok: true, imageBase64 }, 200, cors);
    } catch (e) {
      return json({ error: 'AI generation fail hua: ' + String(e.message || e) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// Verifies a Firebase Auth ID token by asking Google directly —
// no crypto library needed.
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
