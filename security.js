/**
 * ============================================================
 *  ATHARAV KITCHEN — RUNTIME SECURITY MODULE v1.0
 *  10-Layer Defense System
 *  Load this FIRST in every HTML page (before app.js)
 * ============================================================
 */
(function(){
  'use strict';

  // ── LAYER 1: Console Warning — Hackers ko dara do ─────────
  if(typeof console!=='undefined'){
    console.log('%c⛔ STOP!','color:red;font-size:3rem;font-weight:bold;');
    console.log('%cYeh browser console developers ke liye hai.\nAgar kisi ne tumhe yahan kuch paste karne ko kaha hai — woh SCAM hai!\nAtharav Kitchen ki team kabhi console mein kuch paste karne ko nahi bolegi.','color:#d63031;font-size:1rem;font-weight:bold;');
  }

  // ── LAYER 2: Dev Tools Detection ─────────────────────────
  var _devToolsOpen=false;
  var _threshold=160;
  setInterval(function(){
    if(window.outerWidth-window.innerWidth>_threshold||window.outerHeight-window.innerHeight>_threshold){
      if(!_devToolsOpen){_devToolsOpen=true;}
    }else{_devToolsOpen=false;}
  },1000);
  window.isDevToolsOpen=function(){return _devToolsOpen;};

  // ── LAYER 3: Right-click & F12 block on admin pages ──────
  if(window.location.pathname.indexOf('admin')>-1||window.location.pathname.indexOf('rider')>-1){
    document.addEventListener('contextmenu',function(e){e.preventDefault();return false;});
    document.addEventListener('keydown',function(e){
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (view source)
      if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='J'||e.key==='C'))||(e.ctrlKey&&e.key==='u')){
        e.preventDefault();return false;
      }
    });
  }

  // ── LAYER 4: XSS Filter — URL param sanitization ─────────
  window.akSafeParam=function(val){
    if(val==null)return '';
    return String(val).replace(/[<>"'`\\/]/g,'').substring(0,200);
  };

  // ── LAYER 5: Clickjacking Guard ───────────────────────────
  // Agar site frame mein load ho toh top level par redirect karo
  try{
    if(window.self!==window.top){window.top.location=window.self.location;}
  }catch(e){
    // Cross-origin frame — page blank karo
    document.documentElement.innerHTML='<h1 style="font-family:sans-serif;text-align:center;padding:3rem;color:red;">⛔ Unauthorized Access</h1>';
  }

  // ── LAYER 6: Session Integrity Check ─────────────────────
  window.akCheckSessionAge=function(maxAgeMs){
    try{
      var s=JSON.parse(sessionStorage.getItem('ak_admin_session'));
      if(!s||!s.ts)return false;
      return (Date.now()-s.ts)<maxAgeMs;
    }catch(e){return false;}
  };

  // ── LAYER 7: Honeypot field detector ─────────────────────
  // Forms mein hidden fields add karo — bots unhe fill karte hain
  window.akHoneypotCheck=function(formEl){
    var hp=formEl.querySelector('[name="website"],[name="url"],[name="hp"]');
    if(hp&&hp.value!=='')return false; // Bot detected
    return true;
  };

  // ── LAYER 8: Input flood protection ───────────────────────
  var _inputCounts={};
  window.akInputFloodCheck=function(field,maxPerMin){
    var now=Date.now();
    if(!_inputCounts[field])_inputCounts[field]=[];
    _inputCounts[field]=_inputCounts[field].filter(function(t){return now-t<60000;});
    if(_inputCounts[field].length>=maxPerMin)return false;
    _inputCounts[field].push(now);
    return true;
  };

  // ── LAYER 9: localStorage tampering detection ─────────────
  window.akStorageIntegrityCheck=function(){
    try{
      var menu=JSON.parse(localStorage.getItem('ak_menu'));
      if(menu&&Array.isArray(menu)){
        // Check if any price is suspiciously low (< 1) = price manipulation attempt
        var suspicious=menu.some(function(i){return i.price<1||i.price>10000;});
        if(suspicious){
          console.warn('[AK Security] Menu price tampering detected — reloading fresh data');
          localStorage.removeItem('ak_menu');
          return false;
        }
      }
      return true;
    }catch(e){return true;}
  };

  // ── LAYER 10: Error masking — internal details hide karo ──
  window.addEventListener('error',function(e){
    // Production mein stack trace console mein print karo but user ko show mat karo
    if(e&&e.error&&e.error.stack){
      // Stack trace suppress in production
      var isLocal=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1';
      if(!isLocal)e.preventDefault();
    }
  });

  // Run integrity check on load
  window.addEventListener('DOMContentLoaded',function(){
    akStorageIntegrityCheck();
  });

  window._akSecurityLoaded=true;
  if(window.location.hostname==='localhost')console.info('[AK Security] ✅ 10-Layer Security Module loaded');

})();
