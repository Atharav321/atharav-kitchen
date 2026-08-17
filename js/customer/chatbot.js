/**
 * ============================================================
 *  ATHARAV KITCHEN — chatbot.js v2.0
 *
 *  Hybrid chatbot:
 *   - FREE TEXT input → calls /chat Worker (Claude Haiku)
 *   - QUICK REPLY chips → instant local FAQ answers (no API call)
 *   - Fallback: if WORKER_URL not set, all answers from local FAQ
 *
 *  Setup:
 *   Set window.AK_CHAT_WORKER_URL before this script loads:
 *   e.g. 'https://atharav-ai-agent.workers.dev'
 *   (Add to js/core/env-config.js as window.__ENV_CHAT_WORKER_URL)
 * ============================================================
 */
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────
  var WORKER_URL = window.__ENV_CHAT_WORKER_URL || window.AK_CHAT_WORKER_URL || '';
  var WA_LINK = 'https://wa.me/917903567007';
  var MAX_HISTORY = 6; // last 3 turns (user+assistant)

  // ── Local FAQ (quick replies — always available offline) ──
  var QA = [
    {
      id: 'loc',
      q: '📍 Location kaha hai?',
      a: 'Hum <strong>1st Floor, Shastri Nagar, Jain Mandir Road, Near Saroj Apartment, Bank More, Dhanbad, Jharkhand – 826001</strong> par hain. Call: <a href="tel:+917903567007">+91 79035 67007</a>',
    },
    {
      id: 'delivery',
      q: '💰 Delivery charge kitna hai?',
      a: 'Delivery charge sirf ₹30 hai. <strong>₹399 ya usse zyada ke order pe FREE delivery</strong> milti hai!',
    },
    {
      id: 'timing',
      q: '⏰ Timing kya hai?',
      a: 'Hum <strong>daily 11:00 AM se 3:00 AM</strong> tak open rehte hain — Monday se Sunday, saat din!',
    },
    {
      id: 'order',
      q: '📱 Order kaise kare?',
      a: 'Aap <strong>Zomato</strong>, <strong>Swiggy</strong>, ya seedha <strong>WhatsApp</strong> pe order kar sakte hain. Is website se bhi cart add karke order bhej sakte hain!',
    },
    {
      id: 'menu',
      q: '🍽️ Menu me kya milta hai?',
      a: '<strong>Indo-Western</strong> (Burgers, Wraps), <strong>Chinese</strong> (Noodles, Momos, Chilli Chicken), <strong>Indian</strong> (Butter Chicken, Biryani, Paneer) aur <strong>Drinks</strong>!',
    },
    {
      id: 'time2del',
      q: '🚴 Order kitni der me aayega?',
      a: 'Zyadatar orders <strong>30–45 minutes</strong> mein deliver ho jaate hain.',
    },
    {
      id: 'track',
      q: '🔍 Mera order track karo',
      a: 'Aapka live order tracker khol raha hu...',
      action: function () {
        try {
          if (typeof openTrackModal === 'function') {
            closePanel();
            openTrackModal();
          }
        } catch (e) {}
      },
    },
    {
      id: 'human',
      q: '🙋 Insaan se baat karni hai',
      a: 'Bilkul! Neeche WhatsApp button se seedha hamari team se baat karo — hum turant reply karte hain.',
    },
  ];

  // ── Conversation state ────────────────────────────────────
  var _history = []; // [{role: 'user'|'assistant', content: '...'}]
  var _chatInited = false;
  var _aiTyping = false;

  // ── DOM Helpers ───────────────────────────────────────────
  function $(id) {
    return document.getElementById(id);
  }

  function addMsg(html, who) {
    var body = $('akfb-body');
    if (!body) return;
    var m = document.createElement('div');
    m.className = 'akfb-msg akfb-msg-' + who;
    m.innerHTML = html;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }

  function showTyping() {
    var body = $('akfb-body');
    if (!body) return null;
    var t = document.createElement('div');
    t.className = 'akfb-msg akfb-msg-bot akfb-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
    return t;
  }

  function removeEl(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function setInputDisabled(disabled) {
    var inp = $('akfb-inp');
    var btn = $('akfb-send');
    if (inp) inp.disabled = disabled;
    if (btn) btn.disabled = disabled;
  }

  // ── AI API call ───────────────────────────────────────────
  function askAI(userText, onReply) {
    if (!WORKER_URL) {
      // No worker — use local FAQ fallback
      var lower = userText.toLowerCase();
      var matched = null;
      QA.forEach(function (item) {
        if (
          !matched &&
          item.q
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, '')
            .split(' ')
            .some(function (w) {
              return w.length > 3 && lower.includes(w);
            })
        ) {
          matched = item;
        }
      });
      setTimeout(function () {
        onReply(
          matched
            ? matched.a
            : 'Iske baare mein seedha WhatsApp pe poochho: <a href="' +
                WA_LINK +
                '" target="_blank">+91 79035 67007</a>'
        );
        if (matched && matched.action) matched.action();
      }, 600);
      return;
    }

    // Call Worker /chat endpoint
    fetch(WORKER_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: _history.slice(-MAX_HISTORY),
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        onReply(
          data.reply ||
            'Kuch gadbad ho gayi. WhatsApp try karo: <a href="' + WA_LINK + '">+91 79035 67007</a>'
        );
      })
      .catch(function () {
        onReply(
          'AI abhi offline hai. WhatsApp pe contact karo: <a href="' +
            WA_LINK +
            '" target="_blank">+91 79035 67007</a>'
        );
      });
  }

  // ── Send message flow ─────────────────────────────────────
  function sendUserMessage(text) {
    text = text.trim();
    if (!text || _aiTyping) return;

    addMsg(text, 'user');
    _history.push({ role: 'user', content: text });

    var inp = $('akfb-inp');
    if (inp) inp.value = '';

    _aiTyping = true;
    setInputDisabled(true);
    var typingEl = showTyping();

    askAI(text, function (replyHtml) {
      removeEl(typingEl);
      addMsg(replyHtml, 'bot');
      _history.push({ role: 'assistant', content: replyHtml.replace(/<[^>]+>/g, '') });
      _aiTyping = false;
      setInputDisabled(false);
      var inp2 = $('akfb-inp');
      if (inp2) inp2.focus();
    });
  }

  // ── Quick reply chip click ────────────────────────────────
  function chipClick(item) {
    addMsg(item.q, 'user');
    _history.push({ role: 'user', content: item.q });
    setTimeout(function () {
      addMsg(item.a, 'bot');
      _history.push({ role: 'assistant', content: item.a.replace(/<[^>]+>/g, '') });
      if (item.action) item.action();
    }, 350);
  }

  // ── Render quick reply chips ──────────────────────────────
  function renderChips() {
    var body = $('akfb-body');
    if (!body) return;
    var wrap = document.createElement('div');
    wrap.className = 'akfb-chips';
    QA.forEach(function (item) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'akfb-chip';
      c.textContent = item.q;
      c.onclick = function () {
        chipClick(item);
      };
      wrap.appendChild(c);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  // ── Init chat on first open ───────────────────────────────
  function initChat() {
    if (_chatInited) return;
    _chatInited = true;
    var greeting = WORKER_URL
      ? 'Namaste! 👋 Kuch bhi poochho — main AI assistant hoon, ya neeche se quick option chuno:'
      : 'Namaste! 👋 Main Atharav Kitchen ka helper hoon. Quick sawaalon ke liye neeche chuno:';
    addMsg(greeting, 'bot');
    renderChips();
  }

  function openPanel() {
    var panel = $('akfb-panel');
    var dot = $('akfb-dot');
    if (!panel) return;
    panel.classList.add('akfb-open');
    initChat();
    if (dot) dot.style.display = 'none';
    try {
      localStorage.setItem('akfb_seen_v1', '1');
    } catch (e) {}
    var inp = $('akfb-inp');
    if (inp)
      setTimeout(function () {
        inp.focus();
      }, 300);
  }

  function closePanel() {
    var panel = $('akfb-panel');
    if (panel) panel.classList.remove('akfb-open');
  }

  // ── Attach event listeners ────────────────────────────────
  function init() {
    var fab = $('akfb-fab');
    var closeBtn = $('akfb-close');
    var sendBtn = $('akfb-send');
    var inp = $('akfb-inp');
    var dot = $('akfb-dot');

    if (!fab) return;

    fab.addEventListener('click', function () {
      var panel = $('akfb-panel');
      if (panel && panel.classList.contains('akfb-open')) closePanel();
      else openPanel();
    });

    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var val = inp ? inp.value : '';
        sendUserMessage(val);
      });
    }

    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendUserMessage(inp.value);
        }
      });
    }

    try {
      if (localStorage.getItem('akfb_seen_v1') && dot) dot.style.display = 'none';
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
