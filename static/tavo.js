;(function () {
  "use strict";

  var loaderScript = (typeof document !== "undefined" && document.currentScript) ? document.currentScript : null;
  var STYLE_ID = "gptsovits-tavo-loader-v1";
  var TRACKS_KEY_PREFIX = "indextts_tracks_";
  var LOADER_VERSION = "20260531-restore-snapshot-card-v3";

  function deriveBaseUrl(src) {
    var raw = String(src || "").trim();
    if (!raw) return { baseUrl: "", query: "" };
    try {
      var u = new URL(raw, (typeof location !== "undefined" ? location.href : "http://localhost/"));
      var idx = u.pathname.lastIndexOf("/");
      var basePath = idx >= 0 ? u.pathname.slice(0, idx + 1) : "/";
      return { baseUrl: u.origin + basePath, query: u.search || "" };
    } catch (_) {
      var qIndex = raw.indexOf("?");
      var noQuery = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
      var slash = noQuery.lastIndexOf("/");
      return { baseUrl: slash >= 0 ? noQuery.slice(0, slash + 1) : "", query: qIndex >= 0 ? raw.slice(qIndex) : "" };
    }
  }
  function joinUrl(base, fileName, query) { return String(base || "") + String(fileName || "") + String(query || ""); }
  function withQueryParam(url, key, value) {
    try {
      var u = new URL(url, (typeof location !== "undefined" ? location.href : "http://localhost/"));
      u.searchParams.set(key, String(value));
      return u.href;
    } catch (_) {
      var sep = String(url || "").indexOf("?") >= 0 ? "&" : "?";
      return String(url || "") + sep + encodeURIComponent(key) + "=" + encodeURIComponent(String(value));
    }
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function formatTime(sec) {
    sec = Math.max(0, Number(sec || 0));
    if (!isFinite(sec)) return "--:--";
    return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(Math.floor(sec % 60)).padStart(2, "0");
  }
  function playIcon() { return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'; }
  function $(root, sel) { return root && root.querySelector ? root.querySelector(sel) : null; }
  function $all(root, sel) { return root && root.querySelectorAll ? Array.prototype.slice.call(root.querySelectorAll(sel)) : []; }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".idx-tts{margin:10px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#eee7f4}",
      ".idx-lazy-card{position:relative;display:flex;align-items:center;gap:12px;border-radius:16px;background:radial-gradient(circle at 88% 8%,rgba(216,167,255,.18),transparent 40%),linear-gradient(160deg,rgba(27,21,34,.55),rgba(12,9,16,.55));border:1px solid rgba(206,170,230,.22);padding:14px;backdrop-filter:blur(18px) saturate(130%);-webkit-backdrop-filter:blur(18px) saturate(130%)}",
      ".idx-lazy-play{width:58px;height:58px;border-radius:50%;border:1px solid rgba(206,170,230,.30);background:rgba(20,14,28,.58);color:#eee7f4;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex:0 0 auto}",
      ".idx-lazy-play svg{width:26px;height:26px;fill:currentColor}.idx-lazy-play[data-loading='1']{opacity:.65;cursor:progress}",
      ".idx-lazy-main{min-width:0;flex:1;cursor:pointer}.idx-lazy-title{font-size:17px;font-weight:800;color:#e9c8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.idx-lazy-status{margin-top:4px;font-size:12px;color:rgba(238,231,244,.66);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".idx-lazy-progress{height:4px;margin-top:8px;background:rgba(206,170,230,.13);border-radius:999px;overflow:hidden}.idx-lazy-progress span{display:block;height:100%;background:linear-gradient(90deg,#c890e8,#8ecbff);border-radius:inherit}",
      ".idx-tts[data-touch-guard='1']{pointer-events:none!important}"
    ].join("");
    document.head.appendChild(style);
  }

  function messageElement(scriptEl) {
    var el = scriptEl && scriptEl.parentElement;
    while (el && el !== document.body) {
      if (el.dataset && (el.dataset.messageId || el.dataset.id || el.dataset.mid)) return el;
      if (el.classList && (el.classList.contains("message") || el.classList.contains("mes"))) return el;
      el = el.parentElement;
    }
    return scriptEl && scriptEl.parentElement;
  }
  function pickMessageId(scriptEl) {
    try {
      var msgEl = messageElement(scriptEl);
      if (msgEl && msgEl.dataset) return String(msgEl.dataset.messageId || msgEl.dataset.id || msgEl.dataset.mid || "").trim();
    } catch (_) {}
    try { return String((scriptEl && scriptEl.parentElement && (scriptEl.parentElement.id || scriptEl.parentElement.dataset.id)) || "").trim(); } catch (_) {}
    return "";
  }
  function localTracksForMessage(messageId) {
    if (!messageId) return [];
    var key = TRACKS_KEY_PREFIX + messageId;
    try {
      if (window.tavo && typeof window.tavo.get === "function") {
        var cv = window.tavo.get(key, "chat");
        if (Array.isArray(cv) && cv.length) return cv;
        var gv = window.tavo.get(key, "global");
        if (Array.isArray(gv) && gv.length) return gv;
      }
    } catch (_) {}
    try { var raw = localStorage.getItem(key); var arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch (_) {}
    return [];
  }
  function latestTrack(messageId) {
    var arr = localTracksForMessage(messageId).filter(function (t) { return !!(t && t.cacheKey); });
    return arr.length ? arr[arr.length - 1] : null;
  }
  function shortName(v) {
    v = String(v || "").trim();
    if (!v) return "语音";
    var parts = v.split(/[\\/]/);
    return parts[parts.length - 1] || v;
  }

  function loadScript(src, setup) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      if (typeof setup === "function") { try { setup(s); } catch (_) {} }
      s.onload = function () { resolve(s); };
      s.onerror = function () { reject(new Error(src)); };
      (document.head || document.documentElement || document.body).appendChild(s);
    });
  }

  try {
    ensureStyle();
    if (loaderScript && loaderScript.dataset.gptsovitsLoaderMounted === "1") return;
    if (loaderScript) loaderScript.dataset.gptsovitsLoaderMounted = "1";
    var msgEl = messageElement(loaderScript);
    if (msgEl && msgEl !== document.body && msgEl !== document.documentElement) {
      $all(msgEl, ".idx-tts").forEach(function (node) { if (node.parentNode) node.parentNode.removeChild(node); });
    }
    var root = document.createElement("div");
    root.className = "idx-tts";
    if (loaderScript && loaderScript.parentNode) loaderScript.parentNode.insertBefore(root, loaderScript.nextSibling); else document.body.appendChild(root);

    var info = deriveBaseUrl(loaderScript && loaderScript.src);
    var runtimeSrc = withQueryParam(joinUrl(info.baseUrl || "", "tavo.runtime.js", info.query || ""), "runtime_v", LOADER_VERSION);
    try { window.__gptsovits_tavo_loader_version = LOADER_VERSION; } catch (_) {}
    var messageId = pickMessageId(loaderScript);
    var latest = latestTrack(messageId);
    var historyCount = localTracksForMessage(messageId).filter(function (t) { return !!(t && t.cacheKey); }).length;
    var resumeSec = latest ? Math.max(0, Number(latest.lastElementSec || latest.lastWebAudioSec || 0) || 0) : 0;
    var title = shortName(latest && latest.voice);
    root.innerHTML = [
      '<div class="idx-lazy-card" data-role="lazy-card">',
      '  <button class="idx-lazy-play" type="button" data-role="lazy-play" aria-label="播放最后一条语音" title="' + escapeHtml(resumeSec ? ('从 ' + formatTime(resumeSec) + ' 继续') : '播放语音') + '">' + playIcon() + '</button>',
      '  <div class="idx-lazy-main" data-role="lazy-open" role="button" tabindex="0">',
      '    <div class="idx-lazy-title">' + escapeHtml(title) + '</div>',
      '    <div class="idx-lazy-status" data-role="lazy-status">' + (latest ? ('历史音频 ' + historyCount + ' 条 · ' + formatTime(resumeSec)) : '历史音频 0 条 · 点开播放器') + '</div>',
      '    <div class="idx-lazy-progress"><span style="width:' + (latest && latest.duration_s ? Math.max(2, Math.min(100, resumeSec / Number(latest.duration_s || 1) * 100)) : 0) + '%"></span></div>',
      '  </div>',
      '</div>'
    ].join("");

    var bootPromise = null;
    function mountRuntime(clickSelector) {
      if (bootPromise) return bootPromise.then(function () { return clickSelector; });
      var playBtn = $(root, '[data-role="lazy-play"]');
      if (playBtn) playBtn.setAttribute("data-loading", "1");
      bootPromise = loadScript(runtimeSrc, function () {
        try { window.__gptsovits_tavo_runtime_script_override = loaderScript; } catch (_) {}
      }).then(function () {
        root.setAttribute("data-runtime-loaded", "1");
        root.setAttribute("data-touch-guard", "1");
        setTimeout(function () { try { root.removeAttribute("data-touch-guard"); } catch (_) {} }, 450);
        return clickSelector;
      }).catch(function (e) {
        bootPromise = null;
        if (playBtn) playBtn.removeAttribute("data-loading");
        throw e;
      }).finally(function () {
        try { if (window.__gptsovits_tavo_runtime_script_override === loaderScript) window.__gptsovits_tavo_runtime_script_override = null; } catch (_) {}
      });
      return bootPromise;
    }
    function route(selector) {
      mountRuntime(selector).then(function (sel) {
        var scope = messageElement(loaderScript) || document;
        var btn = $(scope, sel) || $(document, sel);
        if (btn) btn.click();
      }).catch(function (e) { try { console.error("[GPT-SoVITS TAVO loader]", e && e.message ? e.message : e); } catch (_) {} });
    }
    on($(root, '[data-role="lazy-play"]'), "click", function (ev) { ev.preventDefault(); ev.stopPropagation(); mountRuntime(""); });
    on($(root, '[data-role="lazy-open"]'), "click", function (ev) { ev.preventDefault(); mountRuntime(""); });
    on($(root, '[data-role="lazy-open"]'), "keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); mountRuntime(""); } });
  } catch (e) {
    try { console.error("[GPT-SoVITS TAVO loader]", e && e.stack ? e.stack : e); } catch (_) {}
  }
})();
