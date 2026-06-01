// GPT-SoVITS Tavo runtime part: 05_message_text_config.js
// Role: message text cleaning, message context, config loading, icon helpers, and style presets.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
  function collapseBodyText(text) {
    return String(text || "")
      .replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*([，。！？；：、,.!?;:])\s*/g, "$1")
      .replace(/\s*[\r\n]+\s*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  function stripTaggedBlocks(text) {
    var s = String(text || '');
    if (!s) return '';
    s = s.replace(/<!--__TTS_WIDGET_START__-->[\s\S]*?<!--__TTS_WIDGET_END__-->/g, ' ');
    s = s.replace(/<!--[\s\S]*?-->/g, ' ');
    s = s.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
    s = s.replace(/[＜﹤]/g, '<').replace(/[＞﹥]/g, '>');
    s = s.replace(/```[\s\S]*?```/g, ' ');
    s = s.replace(/~~~[\s\S]*?~~~/g, ' ');
    var structuralTags = [
      'think', 'thinking', 'reasoning', 'analysis', 'scratchpad', 'thought', 'cot',
      'slate', 'image_gen', 'snapshot', 'roundsummary', 'round_summary', 'summary',
      'directornotes', 'director_notes', 'offcam', 'option', 'opt',
      'bonusclip', 'bonus_clip', 'hiddenvarupdate', 'hidden_var_update',
      'scene_no', 'sceneno', 'currenttime', 'current_time', 'currentlocation', 'current_location'
    ];
    var structuralRe = new RegExp('<\\s*(?:' + structuralTags.join('|') + ')(?:\\s+[^>]*)?>[\\s\\S]*?<\\s*\\/\\s*(?:' + structuralTags.join('|') + ')\\s*>', 'gi');
    var prev = '', iter = 0;
    while (s && s !== prev && iter < 30) { prev = s; s = s.replace(structuralRe, ' '); iter++; }
    var htmlContainerRe = /<\s*(?:div|section|article|aside|details|summary|table|ul|ol|li|script|style)\b[^>]*>[\s\S]*?<\s*\/\s*(?:div|section|article|aside|details|summary|table|ul|ol|li|script|style)\s*>/gi;
    prev = ''; iter = 0;
    while (s && s !== prev && iter < 30) { prev = s; s = s.replace(htmlContainerRe, ' '); iter++; }
    var innerPairedRe = /<\s*[^>\s\/][^>]*>[^<]*?<\s*(?:\/|[|｜]?\s*end[\s_▁-]*of[\s_▁-]*)[^>]*>/g;
    prev = ''; iter = 0;
    while (s && s !== prev && iter < 50) { prev = s; s = s.replace(innerPairedRe, ' '); iter++; }
    s = s.replace(/^\s*(?:thinking|think|reasoning|analysis|scratchpad|thought|cot|思考|推理|分析)\s*[:：].*$/gim, ' ');
    s = s.replace(/<\s*[a-zA-Z][\w:-]*\b[^>]*\/\s*>/gi, ' ');
    s = s.replace(/<[^>\r\n]+>/g, ' ');
    return s;
  }
  function stripMarkdownNoise(text) {
    var s = String(text || '');
    if (!s) return '';
    s = s.replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ');
    s = s.replace(/^\s{0,3}```.*$/gm, ' ');
    s = s.replace(/^\s{0,3}~~~.*$/gm, ' ');
    s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '');
    s = s.replace(/^\s{0,3}>\s?/gm, '');
    s = s.replace(/^\s{0,3}(?:[-*+]\s+|\d+\.\s+)/gm, '');
    s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, ' ');
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    s = s.replace(/`+/g, ' ');
    return s;
  }
  function stripSpecialSymbols(text) {
    var s = String(text || '');
    if (!s) return '';
    s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/gu, ' ');
    s = s.replace(/[★☆✦✧✨❤♡♥♦♣♠※◆◇●○◎■□▼▽▲△【】〔〕〖〗〘〙]/g, ' ');
    s = s.replace(/(^|[\s\u3000"'“”‘’.,!?;:，。！？；：])(?:[:;=8xX][\-^'"]?[)(DPpOo\/\\|]+|\^[_\-]?\^|T[_\-]?T|Q[_\-]?Q|>[_\-]?<|=_=)(?=$|[\s\u3000"'“”‘’.,!?;:，。！？；：])/g, '$1 ');
    return s;
  }
  function extractMessageBody(text) {
    var narrative = stripTaggedBlocks(text);
    narrative = stripMarkdownNoise(narrative);
    narrative = narrative.replace(/关系温度[:：][^\s]+/g, ' ');
    narrative = narrative.replace(/✧\s*\d+\s*天/g, ' ');
    narrative = stripSpecialSymbols(narrative);
    return collapseBodyText(narrative);
  }

  function inlineHost(scriptEl) {
    var parent = scriptEl && scriptEl.parentElement;
    if (parent && parent !== document.head && parent !== document.body && parent !== document.documentElement) return parent;
    return document.body || document.documentElement;
  }
  function messageElement(scriptEl) {
    var host = inlineHost(scriptEl);
    if (!host || !host.closest) return host;
    return host.closest('.mes, [mesid], [data-message-id], .message, .tavo-message, article, li') || host;
  }
  function domMessageId(el) {
    if (!el) return "";
    try {
      var msg = (el.closest && el.closest('.mes, [mesid], [data-message-id], .message, .tavo-message, article, li')) || el;
      var ds = msg && msg.dataset ? msg.dataset : {};
      return String((ds && (ds.messageId || ds.id || ds.mid)) || (msg && msg.getAttribute && (msg.getAttribute("mesid") || msg.getAttribute("data-message-id"))) || (msg && msg.id) || "").trim();
    } catch (_) { return ""; }
  }
  function domAvatarUrl(el) {
    if (!el || !el.querySelector) return "";
    var selectors = '.avatar img[src], .mesAvatarWrapper img[src], img.avatar[src], [class*="avatar"] img[src], [class*="Avatar"] img[src]';
    var img = null;
    try { img = el.querySelector(selectors); } catch (_) { img = el.querySelector('img[src]'); }
    if (!img && el.closest) {
      var msg = el.closest('.mes, [mesid], [data-message-id], .message, .tavo-message, article, li');
      if (msg && msg !== el) {
        try { img = msg.querySelector(selectors); } catch (_) { img = msg.querySelector('img[src]'); }
      }
    }
    return img ? (img.currentSrc || img.src || "") : "";
  }
  function normalizeTavoAssetUrl(url) {
    url = String(url || "").trim();
    if (!url) return "";
    if (/^(https?:|blob:|data:)/i.test(url)) return url;
    try { return new URL(url.replace(/^\/+/, ""), window.location.origin + "/").href; }
    catch (_) { return url; }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = scriptAssetUrl("tavo.ui.skin.default.css") + "?skin_v=" + encodeURIComponent(String((window.__gptsovits_tavo_loader_version || CONFIG_VERSION)));
    link.onerror = function () { debugLog("❌ UI skin CSS 加载失败: " + link.href, "#f99"); };
    document.head.appendChild(link);
  }

  async function getConfig() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); } catch (_) {}
    if (!saved) { try { if (window.tavo && typeof tavo.get === "function") saved = await tavo.get(CONFIG_KEY, "global"); } catch (_) {} }
    var savedVersion = Number(saved && saved.configVersion || 0) || 0;
    var cfg = Object.assign({}, DEFAULT_CONFIG, pickGlobalConfig(saved || {}));
    if (savedVersion < CONFIG_VERSION) {
      if (savedVersion < 7 && cfg.qualityMode === "fast") cfg.qualityMode = "balanced";
      if (Number(cfg.topP) === 0.72 || Number(cfg.topP) === 0.78 || Number(cfg.topP) === 0.85) cfg.topP = 0.8;
      if (Number(cfg.temperature) === 0.62 || Number(cfg.temperature) === 0.72 || Number(cfg.temperature) === 0.78 || Number(cfg.temperature) === 0.8 || Number(cfg.temperature) === 0.85) cfg.temperature = 0.7;
      if (Number(cfg.repetitionPenalty) === 2 || Number(cfg.repetitionPenalty) === 8 || Number(cfg.repetitionPenalty) === 10) cfg.repetitionPenalty = 1.2;
      if (Number(cfg.speedFactor) === 1.08) cfg.speedFactor = 1.0;
      if (savedVersion < 11) {
        if (!cfg.llmEndpoint) cfg.llmEndpoint = "http://192.168.8.100:8317/v1";
        if (!cfg.llmModel) cfg.llmModel = "渡鸦/grok-4.20-fast";
      }
    }
    cfg.configVersion = CONFIG_VERSION;
    // 强制把 apiBase 锁死成本次加载脚本的来源 —— 用户换 LAN/外网/隧道 URL 时
    // 不会被 localStorage 里残留的旧 apiBase 拖累，所有请求一定打回脚本同源。
    cfg.apiBase = scriptOrigin();
    if (cfg.roleVoicesText && !/^\s*旁白\s*[=:：]/m.test(cfg.roleVoicesText)) {
      var m = String(cfg.roleVoicesText).match(/^\s*narrator\s*[=:：]\s*(.+)$/m);
      if (m && m[1]) cfg.roleVoicesText = "旁白=" + m[1].trim() + "\n" + cfg.roleVoicesText;
    }
    // 旧版用户的 cfg 没有 roleVoiceList —— 从 roleVoicesText 迁移过来
    if (!Array.isArray(cfg.roleVoiceList) || cfg.roleVoiceList.length === 0) {
      cfg.roleVoiceList = parseRoleVoiceText(cfg.roleVoicesText || "");
    }
    return cfg;
  }
  function pickGlobalConfig(cfg) {
    var out = {};
    if (!cfg || typeof cfg !== "object") return out;
    GLOBAL_CONFIG_FIELDS.forEach(function (key) {
      if (cfg[key] !== undefined) out[key] = cfg[key];
    });
    return out;
  }
  function pickCharacterConfig(cfg) {
    return {
      defaultVoice: cfg.defaultVoice || "",
      characterName: cfg.currentCharacterName || "",
      roleVoiceList: normalizeRoleVoiceList(cfg.roleVoiceList || [], cfg.currentCharacterName),
    };
  }
  // 把旧 textarea 文本(每行/逗号分隔的 role=voice)转成结构化数组
  function parseRoleVoiceText(text) {
    var out = [];
    String(text || "").split(/[\r\n,，;；]+/).forEach(function (line) {
      var m = line.trim().match(/^(.+?)[=:：]\s*(.+)$/);
      if (m) out.push({ role: m[1].trim(), voice: m[2].trim() });
    });
    return out.length ? out : [
      { role: "旁白", voice: "" },
      { role: "用户", voice: "" },
    ];
  }
  // 反向序列化:给老路径(parseRoleVoices)和后端 voices 字典提供数据
  function serializeRoleVoiceList(list) {
    return (list || []).filter(function (r) { return r.role && r.voice; })
      .map(function (r) { return r.role + "=" + r.voice; }).join("\n");
  }
  function rolesListToVoicesMap(list, defaultVoice, characterRoleName, context) {
    var normalized = normalizeRoleVoiceList(list || [], characterRoleName);
    var out = { default: defaultVoice || "" };
    (normalized || []).forEach(function (r) {
      if (r.role && r.voice) out[r.role] = r.voice;
    });
    var userVoice = out["用户"] || voiceForRoleNames(normalized, ["用户", "你", "user", "我"], characterRoleName);
    if (userVoice) {
      normalizedUserAliases(context).forEach(function (alias) {
        if (alias && !out[alias]) out[alias] = userVoice;
      });
    }
    return out;
  }
  function missingVoiceRolesForSegments(segments, voicesMap) {
    var missing = [];
    var seen = {};
    (segments || []).forEach(function (seg) {
      var role = String((seg && seg.role) || "旁白").trim() || "旁白";
      if (seen[role]) return;
      seen[role] = true;
      if (!voicesMap || !voicesMap[role]) missing.push(role);
    });
    return missing;
  }
  var OFFLINE_DB_NAME = "indextts_tavo_audio_v1";
  var OFFLINE_DB_STORE = "audio";
  var OFFLINE_DB_PROMISE = null;
  function offlineAudioKey(cacheKey) {
    cacheKey = String(cacheKey || "").trim();
    return cacheKey ? "cache:" + cacheKey : "";
  }
  function openOfflineAudioDb() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("当前 WebView 不支持 IndexedDB"));
    if (OFFLINE_DB_PROMISE) return OFFLINE_DB_PROMISE;
    OFFLINE_DB_PROMISE = new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(OFFLINE_DB_NAME, 1); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_DB_STORE)) db.createObjectStore(OFFLINE_DB_STORE, { keyPath: "key" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("IndexedDB 打开失败")); };
      req.onblocked = function () { reject(new Error("IndexedDB 被旧页面占用")); };
    });
    return OFFLINE_DB_PROMISE;
  }
  function offlineDbRequest(mode, fn) {
    return openOfflineAudioDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(OFFLINE_DB_STORE, mode);
        var store = tx.objectStore(OFFLINE_DB_STORE);
        var req;
        try { req = fn(store); } catch (e) { reject(e); return; }
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || tx.error || new Error("IndexedDB 操作失败")); };
      });
    });
  }
  function getOfflineAudioRecord(key) {
    if (!key) return Promise.resolve(null);
    return offlineDbRequest("readonly", function (store) { return store.get(key); }).catch(function () { return null; });
  }
  function putOfflineAudioRecord(record) {
    return offlineDbRequest("readwrite", function (store) { return store.put(record); });
  }
  function deleteOfflineAudioRecord(key) {
    if (!key) return Promise.resolve(false);
    return offlineDbRequest("readwrite", function (store) { return store.delete(key); }).then(function () { return true; }).catch(function () { return false; });
  }
  async function saveConfig(cfg, characterId) {
    // 写入前 normalize 一次,杜绝脏数据回到 storage
    if (Array.isArray(cfg.roleVoiceList)) cfg.roleVoiceList = normalizeRoleVoiceList(cfg.roleVoiceList, cfg.currentCharacterName);
    // 全局只保存 LLM/api/mode/推理参数，不保存任何音色。
    var globalCfg = pickGlobalConfig(cfg);
    try { if (window.tavo && typeof tavo.set === "function") await tavo.set(CONFIG_KEY, globalCfg, "global"); } catch (_) {}
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(globalCfg)); } catch (_) {}
    // 角色级: defaultVoice + roleVoiceList 写 TAVO character scope。
    await saveCharacterCfg(characterId, pickCharacterConfig(cfg));
  }
  function pickAvatarUrl(obj) {
    if (!obj || typeof obj !== "object") return "";
    var keys = ["avatar", "avatarUrl", "avatar_url", "icon", "iconUrl", "image", "imageUrl", "photo", "profileImage", "profile_image"];
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object") {
        var nested = pickAvatarUrl(v);
        if (nested) return nested;
      }
    }
    return "";
  }

  async function currentMessageContext() {
    var text = "";
    var msgEl = messageElement(script);
    var avatarUrl = domAvatarUrl(msgEl);
    var characterName = "";
    var characterId = "";
    var messageId = "";
    var userName = "";
    var userAvatarUrl = "";
    var userAliases = [];
    var userDescription = "";
    try {
      if (window.tavo && tavo.message && typeof tavo.message.current === "function") {
        var msg = await tavo.message.current();
        if (msg && msg.content) text = String(msg.content);
        if (msg && msg.id != null) messageId = String(msg.id);
        if (msg && msg.characterId != null) {
          characterId = String(msg.characterId);
          if (window.tavo && tavo.character && typeof tavo.character.get === "function") {
            var character = await tavo.character.get(msg.characterId);
            if (character) {
              characterName = character.nickname || character.name || "";
              avatarUrl = avatarUrl || character.avatar || pickAvatarUrl(character);
            }
          }
        }
        avatarUrl = avatarUrl || pickAvatarUrl(msg) || pickAvatarUrl(msg && (msg.character || msg.role || msg.sender || msg.author));
      }
    } catch (_) {}
    try {
      if (window.tavo && tavo.chat && typeof tavo.chat.current === "function") {
        var chat = await tavo.chat.current();
        if (chat && chat.persona) {
          userName = String(chat.persona.name || "").trim();
          userDescription = collectUserAliasesFromPersona(chat.persona, userAliases) || userDescription;
          userAvatarUrl = userAvatarUrl || pickAvatarUrl(chat.persona);
          if (chat.persona.id != null && window.tavo && tavo.persona && typeof tavo.persona.get === "function") {
            var persona = await tavo.persona.get(chat.persona.id);
            if (persona) {
              userName = String(persona.name || userName || "").trim();
              userDescription = collectUserAliasesFromPersona(persona, userAliases) || userDescription;
              userAvatarUrl = userAvatarUrl || pickAvatarUrl(persona);
            }
          }
        }
      }
    } catch (_) {}
    try {
      if (!avatarUrl && window.tavo && tavo.character && typeof tavo.character.current === "function") avatarUrl = pickAvatarUrl(await tavo.character.current());
      if (!avatarUrl && window.tavo && tavo.role && typeof tavo.role.current === "function") avatarUrl = pickAvatarUrl(await tavo.role.current());
    } catch (_) {}
    if (!avatarUrl) avatarUrl = domAvatarUrl(script && script.parentElement);
    avatarUrl = normalizeTavoAssetUrl(avatarUrl);
    userAvatarUrl = normalizeTavoAssetUrl(userAvatarUrl);
    if (!text && msgEl) {
      try {
        var clone = msgEl.cloneNode(true);
        clone.querySelectorAll('.idx-tts, .idx-card, .idx-panel, .idx-global-gear, script').forEach(function (n) { n.remove(); });
        text = clone.innerText || clone.textContent || "";
      } catch (_) { text = msgEl.innerText || msgEl.textContent || ""; }
    }
    var cleanText = extractMessageBody(text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\[IndexTTS_TAVO_SCRIPT\]/g, ""));
    if (!messageId) messageId = domMessageId(msgEl);
    if (!messageId && cleanText) messageId = "message-" + stableHash(cleanText);
    pushUserAlias(userAliases, userName);
    return { text: cleanText, avatarUrl: avatarUrl, characterName: characterName, characterId: characterId, messageId: messageId, userName: userName, userAliases: userAliases, userDescription: shortText(userDescription, 900), userAvatarUrl: userAvatarUrl };
  }
  // 每条消息的播放历史持久化：key = "indextts_tracks_<messageId>"。
  // 只存可重建的元信息（cacheKey + voice + mode + offlineKey），不存 blob。
  // 重新进页面时优先从 IndexedDB 读本机缓存音频；缺失时通过 /cache_audio/{cacheKey} 接上。
  var TRACKS_KEY_PREFIX = "indextts_tracks_";
  async function loadTracksForMessage(messageId) {
    if (!messageId) return [];
    var key = TRACKS_KEY_PREFIX + messageId;
    try { var raw = localStorage.getItem(key); if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } } catch (_) {}
    try { if (window.tavo && typeof tavo.get === "function") { var cv = await tavo.get(key, "chat"); if (Array.isArray(cv)) return cv; } } catch (_) {}
    try { if (window.tavo && typeof tavo.get === "function") { var v = await tavo.get(key, "global"); if (Array.isArray(v)) return v; } } catch (_) {}
    return [];
  }
  function localTracksForMessage(messageId) {
    if (!messageId) return [];
    var key = TRACKS_KEY_PREFIX + messageId;
    // AR webview 重建/重进页面后 localStorage 会被清空，tavo 变量才是持久源。
    // 变量操作是同步的，优先同步读 tavo.get；读不到（或本版 tavo.get 返回 Promise）
    // 再回退 localStorage。否则懒加载时首页历史条数永远显示 0。
    try {
      if (window.tavo && typeof tavo.get === "function") {
        var cv = tavo.get(key, "chat");
        if (Array.isArray(cv) && cv.length) return cv;
        var gv = tavo.get(key, "global");
        if (Array.isArray(gv) && gv.length) return gv;
      }
    } catch (_) {}
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {}
    return [];
  }
  function localHistoryCountForMessage(messageId) {
    return localTracksForMessage(messageId).filter(function (t) { return !!(t && t.cacheKey); }).length;
  }
  async function saveTracksForMessage(messageId, tracks) {
    if (!messageId) return;
    var key = TRACKS_KEY_PREFIX + messageId;
    // 只挑能跨会话持久化的字段；blob URL 重启就失效，丢掉。
    // segments 也存下来,字幕重进页面后才有时间轴显示。
    var lite = (tracks || []).map(function (t) {
      var state = String((t && t.state) || "").trim();
      if (state !== "pending" && state !== "live" && state !== "saved" && state !== "failed") {
        state = (t && (t.cacheReady || t.fromHistory || t.status === "ready")) ? "saved" : ((t && (t.streamUrl || t.streaming || t.status === "running" || t.pendingBlob)) ? "live" : "pending");
      }
      return {
        cacheKey: t.cacheKey || "",
        voice: t.voice || "",
        mode: t.mode || "",
        state: state,
        playbackState: t.playbackState || "",
        serverState: t.serverState || "",
        cacheState: t.cacheState || t.remoteCacheState || "",
        remoteCacheState: t.remoteCacheState || t.cacheState || "",
        offlineState: t.offlineState || "",
        streamHealth: t.streamHealth || (t.streamInterrupted ? "interrupted" : (t.streamStalled ? "stalled" : "")),
        stalledCount: Number(t.stalledCount || 0) || 0,
        createdAt: t.createdAt || Date.now(),
        offlineKey: t.offlineKey || offlineAudioKey(t.cacheKey),
        offlineReady: !!t.offlineReady,
        offlineWanted: !!t.offlineWanted,
        offlineSavedAt: t.offlineSavedAt || 0,
        offlineSize: t.offlineSize || 0,
        lastElementSec: Math.max(0, Number(t.lastElementSec || t.lastWebAudioSec || 0) || 0),
        lastWebAudioSec: Math.max(0, Number(t.lastWebAudioSec || t.lastElementSec || 0) || 0),
        voicesMap: t.voicesMap || null,
        metrics: t.metrics ? {
          first_pcm_s: t.metrics.first_pcm_s,
          total_wall_s: t.metrics.total_wall_s,
          audio_duration_s: t.metrics.audio_duration_s,
          rtf: t.metrics.rtf,
          performance_mode: t.metrics.performance_mode,
          diffusion_steps: t.metrics.diffusion_steps,
          segments_total: t.metrics.segments_total,
          segments_done: t.metrics.segments_done
        } : null,
        sampleRate: t.sampleRate || t.sample_rate || 0,
        duration_s: t.duration_s || (t.metrics && t.metrics.audio_duration_s) || 0,
        segments: (t.segments || []).map(function (s) {
          return { role: s.role || "", text: s.text || "", style: s.style || "neutral", style_alpha: s.style_alpha, start_s: s.start_s, start_offset_bytes: s.start_offset_bytes, duration_s: s.duration_s };
        }),
      };
    }).filter(function (t) { return !!t.cacheKey; });
    try { if (window.tavo && typeof tavo.set === "function") await tavo.set(key, lite, "chat"); } catch (_) {}
    try { localStorage.setItem(key, JSON.stringify(lite)); } catch (_) {}
  }
  function playIcon(state) { return state === "playing" ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'; }
  function loadingIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10h-3a7 7 0 1 1-7-7V2z"/></svg>'; }
  function gearIcon() { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="2.2"/><circle cx="15" cy="17" r="2.2"/></svg>'; }
  function formatTime(sec) { sec = Math.max(0, Number(sec || 0)); if (!isFinite(sec)) return "--:--"; return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(Math.floor(sec % 60)).padStart(2, "0"); }
  function latestLocalTrackForMessage(messageId) {
    var arr = localTracksForMessage(messageId).filter(function (t) { return !!(t && t.cacheKey); });
    return arr.length ? arr[arr.length - 1] : null;
  }
  function parseRoleVoices(text, voice) { var out = { default: voice }; String(text || "").split(/[\r\n,，;；]+/).forEach(function (line) { var m = line.trim().match(/^(.+?)[=:：]\s*(.+)$/); if (m) out[m[1].trim()] = m[2].trim(); }); return out; }
  async function listVoices(base) {
    try {
      var r = await fetch(cleanBase(base) + "/voices", { cache: "no-store" });
      if (!r.ok) return [];
      var d = await r.json();
      var list = Array.isArray(d.voices) ? d.voices : [];
      return list.filter(function (v) {
        if (!v) return false;
        if (v.hidden_from_picker || v.disabled_for_gptsovits || v.usable_for_gptsovits === false) return false;
        return v.usable_for_gptsovits === true;
      });
    } catch (_) { return []; }
  }
  function generationQualityOverrides(mode) {
    mode = String(mode || "balanced").trim();
    if (mode === "fast") return { diffusion_steps: 8, sample_steps: 8, batch_size: 8, parallel_infer: true, prompt_audio_seconds: 6, segment_tokens: 40, first_tokens: 10 };
    if (mode === "balanced") return { diffusion_steps: 16, sample_steps: 16, batch_size: 4, parallel_infer: true, prompt_audio_seconds: 10, segment_tokens: 64, first_tokens: 20 };
    if (mode === "ultra") return { diffusion_steps: 32, sample_steps: 32, batch_size: 4, parallel_infer: true, prompt_audio_seconds: 14, segment_tokens: 88, first_tokens: 32 };
    return { diffusion_steps: 24, sample_steps: 24, batch_size: 4, parallel_infer: true, prompt_audio_seconds: 12, segment_tokens: 80, first_tokens: 28 };
  }
  function stripNullishFields(obj) {
    Object.keys(obj || {}).forEach(function (k) {
      if (obj[k] === null || typeof obj[k] === "undefined") delete obj[k];
    });
    return obj;
  }
  function applyGenerationParamsToSearchParams(p, cfg) {
    var q = generationQualityOverrides(cfg && cfg.qualityMode);
    p.set("diffusion_steps", String(q.diffusion_steps));
    p.set("prompt_audio_seconds", String(q.prompt_audio_seconds));
    p.set("segment_tokens", String(q.segment_tokens));
    p.set("first_tokens", String(q.first_tokens));
  }
  var STYLE_PRESETS = [
    { id: "neutral", label: "普通/平静", alpha: 0.20 },
    { id: "breath_soft", label: "轻微气声", alpha: 0.34 },
    { id: "breath_heavy", label: "明显喘息", alpha: 0.46 },
    { id: "intimate_breath", label: "亲密气声", alpha: 0.44 },
    { id: "moan_soft", label: "低声短吟", alpha: 0.48 },
    { id: "low_murmur", label: "压低呢喃", alpha: 0.40 },
    { id: "whisper_soft", label: "温柔耳语", alpha: 0.36 },
    { id: "shy_whisper", label: "害羞低语", alpha: 0.36 },
    { id: "tense_breath", label: "紧张呼吸", alpha: 0.38 },
    { id: "sob_soft", label: "委屈哽咽", alpha: 0.42 },
    { id: "cry_soft", label: "哭腔", alpha: 0.44 },
    { id: "tease_soft", label: "轻声撒娇", alpha: 0.38 },
    { id: "laugh_soft", label: "慵懒轻笑", alpha: 0.34 },
    { id: "gasp_surprise", label: "惊讶轻叹", alpha: 0.38 },
    { id: "scream_peak", label: "尖叫/高潮峰值", alpha: 0.50 },
    { id: "stage_warmup", label: "亲密初段/轻气声", alpha: 0.36 },
    { id: "stage_rising", label: "升温段/呼吸变重", alpha: 0.44 },
    { id: "stage_peak", label: "高潮峰值/尖叫", alpha: 0.50 },
    { id: "stage_afterglow", label: "余韵段/低声放松", alpha: 0.38 }
  ];
  var PERSON_STYLE_VARIANTS = [
    { name: "轻喘", label: "轻喘", alpha: 0.34 },
    { name: "喘息", label: "明显喘息", alpha: 0.46 },
    { name: "耳语", label: "耳语", alpha: 0.36 },
    { name: "低语", label: "低语", alpha: 0.36 },
    { name: "低吟", label: "低声短吟", alpha: 0.48 },
    { name: "惊喘", label: "惊喘", alpha: 0.38 },
    { name: "哭腔", label: "哭腔", alpha: 0.44 },
    { name: "哽咽", label: "哽咽", alpha: 0.42 },
    { name: "挑逗", label: "挑逗", alpha: 0.38 },
    { name: "轻笑", label: "轻笑", alpha: 0.34 },
    { name: "尖叫", label: "尖叫/峰值", alpha: 0.50 },
    { name: "余韵", label: "余韵低声", alpha: 0.38 }
  ];
  ["步非烟", "AD学姐", "JOK"].forEach(function (speaker) {
    PERSON_STYLE_VARIANTS.forEach(function (item) {
      STYLE_PRESETS.push({
        id: item.name + "-" + speaker,
        label: item.label + "/" + speaker,
        alpha: item.alpha
      });
    });
  });
  function styleIdsText() { return STYLE_PRESETS.map(function (s) { return s.id + "=" + s.label + "(建议" + s.alpha + ")"; }).join(" / "); }
  function normalizeStyleId(style) {
    style = String(style || "neutral").trim();
    var ok = STYLE_PRESETS.some(function (s) { return s.id === style; });
    return ok ? style : "neutral";
  }
