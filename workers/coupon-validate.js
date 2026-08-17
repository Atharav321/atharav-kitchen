/**
 * ============================================================
 *  ATHARAV KITCHEN — COUPON VALIDATION (Cloudflare Worker)
 *  v1.0 — Server-side only, tamper-proof
 * ============================================================
 *
 *  PROBLEM (jo fix ho raha hai):
 *    Pehle coupon validation sirf browser mein hoti thi — koi bhi
 *    browser console se COUPONS object edit karke free discount le
 *    sakta tha. Ab discount SIRF is Worker se aata hai, jo Firestore
 *    se coupons fetch karta hai + usage limits enforce karta hai.
 *
 *  KAISE KAAM KARTA HAI:
 *    1. Customer cart mein coupon apply karta hai →
 *    2. Browser is Worker ko call karta hai (Firebase idToken + coupon code + cart subtotal bhejta hai) →
 *    3. Worker idToken verify karta hai, Firestore se coupon fetch karta hai,
 *       usage limits check karta hai, welcome-code "already used" check karta hai →
 *    4. Worker wapas discount amount bhejta hai — browser sirf yahi dikhata hai
 *    5. Order place hone par bhi Worker se final bill validate hota hai
 *
 *  DEPLOY KARNE KA TARIKA (ek baar):
 *  1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *  2. Is file ka poora content paste karo, "Save and Deploy" karo
 *  3. Worker Settings → Variables mein add karo:
 *       FIREBASE_API_KEY           = (firebase-config.js wali apiKey)
 *       FIREBASE_PROJECT_ID        = atharav-kitchen-e587b
 *       ALLOWED_ORIGIN             = https://atharav-kitchen.pages.dev
 *       ADMIN_EMAIL                = chotugupta7395@gmail.com
 *  4. Worker ka URL copy karo (e.g. https://ak-coupon.YOUR.workers.dev)
 *  5. index.html mein <head> ke andar add karo:
 *       <script>window.AK_COUPON_WORKER_URL = 'https://ak-coupon.YOUR.workers.dev';</script>
 * ============================================================
 */

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, cors);
    }

    const { action, idToken, couponCode, subtotal, orderId } = body;

    // ── 1. VERIFY FIREBASE ID TOKEN ───────────────────────────────
    // Koi bhi user ka valid token chahiye (customer ya guest nahi chalta
    // coupon ke liye — real registered user hona chahiye)
    if (!idToken) return json({ error: 'Login required. Pehle register/login karo.' }, 401, cors);

    const authResult = await verifyFirebaseIdToken(idToken, env);
    if (!authResult.ok) {
      return json({ error: 'Login session expire ho gayi. Dobara login karo.' }, 401, cors);
    }
    const uid = authResult.uid;
    const isAnon = authResult.isAnonymous;

    // Guest (anonymous) ko coupon nahi milega — register karna padega
    if (isAnon) {
      return json(
        { error: 'Coupon ke liye account banana padega. Register karo — welcome gift milega!' },
        403,
        cors
      );
    }

    // ── 2. ROUTE: validate OR confirm ────────────────────────────
    if (action === 'validate') {
      return handleValidate({ couponCode, subtotal, uid, env, cors });
    }
    if (action === 'confirm') {
      // Called after order is saved to Firestore — increment usage count
      return handleConfirm({ couponCode, orderId, uid, env, cors });
    }
    return json({ error: "action must be 'validate' or 'confirm'" }, 400, cors);
  },
};

// ── VALIDATE: Check coupon and return discount amount ─────────────
async function handleValidate({ couponCode, subtotal, uid, env, cors }) {
  if (!couponCode || typeof couponCode !== 'string') {
    return json({ error: 'Coupon code missing' }, 400, cors);
  }
  if (typeof subtotal !== 'number' || subtotal <= 0) {
    return json({ error: 'Cart subtotal invalid' }, 400, cors);
  }

  const code = couponCode.trim().toUpperCase();

  // ── Fetch coupon from Firestore ───────────────────────────────
  const couponDoc = await firestoreGet(`coupons/${code}`, env);

  if (!couponDoc) {
    // Coupon Firestore mein nahi hai — check built-in welcome coupon
    const welcomeResult = await validateWelcomeCoupon(code, uid, subtotal, env);
    if (welcomeResult) return json(welcomeResult, welcomeResult.error ? 400 : 200, cors);
    return json({ error: '❌ Invalid coupon code. Sahi code daalo.' }, 400, cors);
  }

  // ── Coupon active hai? ────────────────────────────────────────
  if (couponDoc.active === false) {
    return json({ error: '❌ Yeh coupon ab valid nahi hai.' }, 400, cors);
  }

  // ── Expiry check ──────────────────────────────────────────────
  if (couponDoc.expiresAt) {
    const expiry = new Date(couponDoc.expiresAt);
    if (expiry < new Date()) {
      return json({ error: '❌ Yeh coupon expire ho gaya hai.' }, 400, cors);
    }
  }

  // ── Usage limit check ─────────────────────────────────────────
  if (typeof couponDoc.maxUses === 'number') {
    const usedCount = couponDoc.usedCount || 0;
    if (usedCount >= couponDoc.maxUses) {
      return json({ error: '❌ Yeh coupon ab available nahi — limit khatam ho gayi.' }, 400, cors);
    }
  }

  // ── Per-user usage check (Firestore se) ───────────────────────
  if (couponDoc.onePerUser !== false) {
    const userUsage = await firestoreGet(`coupon_usage/${code}_${uid}`, env);
    if (userUsage) {
      return json({ error: '❌ Tum yeh coupon pehle use kar chuke ho.' }, 400, cors);
    }
  }

  // ── Minimum order check ───────────────────────────────────────
  const minOrder = couponDoc.min || 0;
  if (subtotal < minOrder) {
    return json(
      {
        error:
          '⚠️ Min order ₹' + minOrder + ' chahiye. ₹' + (minOrder - subtotal) + ' aur add karo.',
      },
      400,
      cors
    );
  }

  // ── Calculate discount ────────────────────────────────────────
  const discount = computeDiscount(couponDoc, subtotal);

  return json(
    {
      ok: true,
      discount,
      type: couponDoc.type,
      label: couponDoc.label || code,
      message: '✅ "' + code + '" applied! ₹' + discount + ' bachoge.',
    },
    200,
    cors
  );
}

// ── CONFIRM: Increment usage after order is placed ────────────────
async function handleConfirm({ couponCode, orderId, uid, env, cors }) {
  if (!couponCode || !orderId) {
    return json({ error: 'couponCode and orderId required' }, 400, cors);
  }
  const code = couponCode.trim().toUpperCase();

  // Mark per-user usage
  await firestorePatch(`coupon_usage/${code}_${uid}`, { orderId, usedAt: new Date().toISOString() }, env);

  // Increment global usedCount on the coupon document
  await firestoreIncrement(`coupons/${code}`, 'usedCount', env);

  return json({ ok: true }, 200, cors);
}

// ── WELCOME COUPON: Special logic for WELCOME{amt}_{phone4} ──────
async function validateWelcomeCoupon(code, uid, subtotal, env) {
  // Welcome code format: WELCOME100_XXXX
  if (!code.startsWith('WELCOME')) return null;

  // Firestore se customer doc fetch karo
  const customerDoc = await firestoreGet(`customers/${uid}`, env);
  if (!customerDoc) return { error: '❌ Account nahi mila. Dobara login karo.' };

  if (customerDoc.welcomeCode !== code) {
    return { error: '❌ Yeh welcome code tumhara nahi hai.' };
  }
  if (customerDoc.welcomeCodeUsed) {
    return { error: '❌ Welcome coupon pehle use ho chuka hai — sirf ek baar milta hai!' };
  }

  const minOrder = customerDoc.welcomeCouponMin || 200;
  const discAmt = customerDoc.welcomeCouponAmt || 100;

  if (subtotal < minOrder) {
    return {
      error: '⚠️ Welcome coupon ke liye min order ₹' + minOrder + ' chahiye.',
    };
  }

  return {
    ok: true,
    discount: Math.min(discAmt, subtotal),
    type: 'flat',
    label: '₹' + discAmt + ' OFF — Welcome Gift!',
    message: '✅ Welcome gift applied! ₹' + Math.min(discAmt, subtotal) + ' bachoge. 🎉',
    isWelcome: true,
  };
}

// ── DISCOUNT CALCULATION (server-side mirror of cart.js calcBill) ─
function computeDiscount(coupon, subtotal) {
  if (coupon.type === 'percent') {
    return Math.min(Math.round((subtotal * coupon.value) / 100), coupon.maxDisc || 9999);
  }
  if (coupon.type === 'flat') {
    return Math.min(coupon.value, subtotal);
  }
  if (coupon.type === 'delivery') {
    return 0; // Delivery discount — handled separately on client
  }
  return 0;
}

// ── FIRESTORE REST HELPERS ────────────────────────────────────────
async function firestoreGet(path, env) {
  const projectId = env.FIREBASE_PROJECT_ID || 'atharav-kitchen-e587b';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.fields) return null;
    return firestoreFieldsToObj(data.fields);
  } catch {
    return null;
  }
}

async function firestorePatch(path, obj, env) {
  const projectId = env.FIREBASE_PROJECT_ID || 'atharav-kitchen-e587b';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: objToFirestoreFields(obj) }),
    });
  } catch {
    /* silent — best effort */
  }
}

async function firestoreIncrement(path, field, env) {
  // Simple increment: get current value, add 1, patch it back
  const projectId = env.FIREBASE_PROJECT_ID || 'atharav-kitchen-e587b';
  const doc = await firestoreGet(path, env);
  const current = (doc && typeof doc[field] === 'number' ? doc[field] : 0) + 1;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?updateMask.fieldPaths=${field}`;
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { [field]: { integerValue: current } } }),
    });
  } catch {
    /* silent */
  }
}

// ── FIREBASE ID TOKEN VERIFICATION ───────────────────────────────
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
    if (!res.ok || !data.users || !data.users.length) return { ok: false };
    const user = data.users[0];
    return {
      ok: true,
      uid: user.localId,
      email: user.email || null,
      isAnonymous: !user.email && !user.phoneNumber && !user.providerUserInfo?.length,
    };
  } catch {
    return { ok: false };
  }
}

// ── FIRESTORE FORMAT HELPERS ──────────────────────────────────────
function firestoreFieldsToObj(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = Number(val.integerValue);
    else if (val.doubleValue !== undefined) obj[key] = Number(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.nullValue !== undefined) obj[key] = null;
    else if (val.timestampValue !== undefined) obj[key] = val.timestampValue;
  }
  return obj;
}

function objToFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number' && Number.isInteger(val)) fields[key] = { integerValue: val };
    else if (typeof val === 'number') fields[key] = { doubleValue: val };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else if (val === null) fields[key] = { nullValue: null };
  }
  return fields;
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
