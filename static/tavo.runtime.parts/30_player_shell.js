// GPT-SoVITS Tavo runtime part: 30_player_shell.js // Source: static/tavo.runtime.js lines 1631-2600 before physical split. // Role: player DOM shell, track state, subtitles, history UI // This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script. 
  function mountFull(root, cfg, context) {
    var characterId = (context && context.characterId) ? String(context.characterId) : "";
    var messageText = context && context.text ? context.text : "";
    var avatarUrl = context && context.avatarUrl ? context.avatarUrl : "";
    var userAvatarUrl = context && context.userAvatarUrl ? context.userAvatarUrl : "";
    var messageId = context && context.messageId ? context.messageId : "";
    try {
      $all(document, '.idx-picker').forEach(function (d) {
        try { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
        catch (_) { try { d.removeAttribute('open'); } catch (__) {} }
        try { d.setAttribute('aria-hidden', 'true'); } catch (_) {}
        try { if (d.parentNode) d.parentNode.removeChild(d); } catch (_) {}
      });
    } catch (_) {}
    root.setAttribute("data-player-mounted", "1");
    removeSiblingLazyPlaceholders(root);
    renderFullPlayerShell(root);
    setTimeout(function () { removeSiblingLazyPlaceholders(root); }, 0);
    setTimeout(function () { removeSiblingLazyPlaceholders(root); }, 240);

    var audio = first(root, '[data-role="audio"]', 'audio');
    var play = first(root, '[data-role="play"]', '.idx-ctrl-main');
    var prev = first(root, '[data-role="prev"]');
    var next = first(root, '[data-role="next"]');
    var add = first(root, '[data-role="add"]');
    var del = first(root, '[data-role="delete"]');
    var status = first(root, '[data-role="status"]', '.idx-status');
    var title = first(root, '[data-role="title"]', '.idx-name');
    var cover = first(root, '[data-role="cover"]', '.idx-cover');
    var counter = first(root, '[data-role="counter"]', '.idx-card-counter');
    var err = first(root, '[data-role="error"]', '.idx-error');
    var seek = first(root, '[data-role="seek"]', '.idx-seek');
    var cur = first(root, '[data-role="current"]', '.idx-time span:first-child');
    var total = first(root, '[data-role="total"]', '.idx-time span:last-child');
    var panel = first(root, '[data-role="panel"]', '.idx-panel');
    var gear = first(root, '[data-role="gear"]', '.idx-gear');
    var close = first(root, '[data-role="close"]', '.idx-close');
    // TAVO 容器树上很可能有 transform 祖先(scale / translate),会让 panel/picker
    // 的 position:fixed 误以为相对那个祖先(被截一半)。把它们直接挂到 body 上
    // 彻底逃离变形上下文。下次脚本重载会先清掉旧实例避免叠加。
    try {
      var STALE_HOST_ATTR = 'data-indextts-host';
      Array.prototype.slice.call(document.body.querySelectorAll('[' + STALE_HOST_ATTR + ']')).forEach(function (el) { try { el.remove(); } catch (_) {} });
      if (panel) { panel.setAttribute(STALE_HOST_ATTR, '1'); document.body.appendChild(panel); }
      var pickerNode = first(root, '[data-role="voice-picker"]');
      if (pickerNode) { pickerNode.setAttribute(STALE_HOST_ATTR, '1'); document.body.appendChild(pickerNode); }
    } catch (_) {}
    var voicesBox = first(root, '[data-role="voices"]', '.idx-voices');
    var voicePill = first(root, '[data-role="voice-pill"]');
    var modePill = first(root, '[data-role="mode-pill"]');
    var generatedTracks = [];
    var currentTrackIndex = -1;
    var currentCacheKey = "";
    var webAudioController = null;
    var webAudioPlayToken = 0;
    var webAudioProgressTimer = null;

    if (!panel) throw new Error("TAVO player missing settings panel");
    removeLegacyGlobalGear();

    function setStatus(v) {
      if (!status) return;
      status.textContent = v == null ? "" : String(v);
      // 文字溢出才滚动。停留长 + 步长大 → 不抖。
      try {
        if (status.__idxScrollTimer) { clearInterval(status.__idxScrollTimer); status.__idxScrollTimer = null; }
        status.scrollLeft = 0;
        requestAnimationFrame(function () {
          if (!status) return;
          var excess = status.scrollWidth - status.clientWidth;
          if (excess > 16) {  // 容差大一点,小溢出不滚省得抖
            status.style.overflowX = "hidden";
            status.style.whiteSpace = "nowrap";
            status.style.textOverflow = "clip";
            var direction = 1, holdEnd = 60, holdStart = 60;  // 60×80ms = 4.8s 停留
            var maxScroll = excess;  // 锁死最大位移
            status.__idxScrollTimer = setInterval(function () {
              if (!status || !document.body.contains(status)) {
                clearInterval(status.__idxScrollTimer); status.__idxScrollTimer = null; return;
              }
              if (direction === 1) {
                if (status.scrollLeft >= maxScroll) {
                  status.scrollLeft = maxScroll;  // 钳位防抖
                  if (holdEnd-- > 0) return;
                  direction = -1; holdEnd = 60;
                } else {
                  status.scrollLeft = Math.min(status.scrollLeft + 2, maxScroll);
                }
              } else {
                if (status.scrollLeft <= 0) {
                  status.scrollLeft = 0;
                  if (holdStart-- > 0) return;
                  direction = 1; holdStart = 60;
                } else {
                  status.scrollLeft = Math.max(status.scrollLeft - 2, 0);
                }
              }
            }, 80);  // 80ms / 步,慢一些更顺
          } else {
            status.style.textOverflow = "ellipsis";
          }
        });
      } catch (_) {}
    }
    function historyStatusText() {
      var total = generatedTracks.length;
      if (!total && !tracksLoaded && knownHistoryCount > 0) return "历史音频 " + knownHistoryCount + " 条";
      if (!total) return "历史音频 0 条";
      var idx = currentTrackIndex >= 0 ? currentTrackIndex + 1 : total;
      return "历史音频 " + total + " 条 · 当前 " + idx + "/" + total;
    }
    function messagePreviewText() {
      var t = String(messageText || "").replace(/\s+/g, " ").trim();
      return t.length > 52 ? t.slice(0, 52) + "…" : t;
    }
    function noTrackStatusText() {
      return knownHistoryCount > 0 ? "可恢复上次音频" : "准备生成语音";
    }
    function showNoTrackNotice(detailText) {
      var titleText = knownHistoryCount > 0 ? "上次音频可恢复" : "准备生成语音";
      var detail = detailText || (knownHistoryCount > 0 ? "点播放读取快照并继续" : (messagePreviewText() || "点播放开始生成音频"));
      showTrackNotice(null, titleText, detail);
    }
    function updateTrackCounter() {
      var total = generatedTracks.length || (!tracksLoaded ? knownHistoryCount : 0);
      var idx = total && currentTrackIndex >= 0 ? currentTrackIndex + 1 : 0;
      if (counter) counter.textContent = idx + "/" + total;
    }
    function setError(v) {
      if (err) { err.textContent = ""; err.classList.add("idx-hidden"); }
      if (v) showTrackNotice(currentTrack(), "发生错误", String(v));
    }
    function currentTrack() { return currentTrackIndex >= 0 ? generatedTracks[currentTrackIndex] : null; }
    function currentVoicesMap(track) {
      return (track && track.voicesMap) || rolesListToVoicesMap(cfg.roleVoiceList, cfg.defaultVoice, cfg.currentCharacterName, context);
    }
    function voiceNameForRole(role, track) {
      var voices = currentVoicesMap(track);
      role = String(role || "").trim();
      return (role && voices[role]) || voices.default || cfg.defaultVoice || "";
    }
    function displayRoleName(role) {
      role = String(role || "").trim();
      if (role === "用户") return (context && context.userName) ? context.userName : "用户";
      return role || "旁白";
    }
    function parseReuseHash(text) {
      return stableHash(text);
    }
    function cloneSegments(segments) {
      try { return JSON.parse(JSON.stringify(segments || [])); } catch (_) { return []; }
    }
    function normalizeSegmentsForContext(segments, context) {
      return cloneSegments(segments).map(function (seg) {
        if (!seg || typeof seg !== "object") seg = {};
        var role = String(seg.role || "旁白").trim() || "旁白";
        if (isUserRoleName(role, context)) role = "用户";
        seg.role = role;
        return seg;
      });
    }
    function splitTextForSynthesis(text, maxChars) {
      var raw = String(text || "").trim();
      if (!raw || raw.length <= maxChars) return raw ? [raw] : [];
      var tokens = raw.match(/[^，,、。！？!?；;…]+[，,、。！？!?；;…]*/g) || [raw];
      var out = [];
      var buf = "";
      function pushBuf() {
        var v = String(buf || "").trim();
        if (v) out.push(v);
        buf = "";
      }
      tokens.forEach(function (part) {
        part = String(part || "").trim();
        if (!part) return;
        if (part.length > maxChars + 10) {
          pushBuf();
          for (var i = 0; i < part.length; i += maxChars) out.push(part.slice(i, i + maxChars));
          return;
        }
        if (buf && (buf + part).length > maxChars) pushBuf();
        buf += part;
      });
      pushBuf();
      var merged = [];
      out.forEach(function (part) {
        if (!merged.length) { merged.push(part); return; }
        if (part.length <= 8 && (merged[merged.length - 1] + part).length <= maxChars + 8) merged[merged.length - 1] += part;
        else merged.push(part);
      });
      for (var j = 0; j < merged.length - 1; j++) {
        if (merged[j].length <= 8 && (merged[j] + merged[j + 1]).length <= maxChars + 8) {
          merged[j + 1] = merged[j] + merged[j + 1];
          merged.splice(j, 1);
          j--;
        }
      }
      return merged.length ? merged : [raw];
    }
    function splitSegmentsForSynthesis(segments) {
      var out = [];
      (segments || []).forEach(function (seg) {
        if (!seg || typeof seg !== "object") return;
        var text = String(seg.text || "").trim();
        if (!text) return;
        var maxChars = String(seg.role || "") === "旁白" ? 44 : 30;
        var parts = splitTextForSynthesis(text, maxChars);
        if (parts.length > 1) debugLog("✂️ 合成长句拆分: role=" + (seg.role || "旁白") + " " + text.length + "字 -> " + parts.length + "段", "#9ff");
        parts.forEach(function (part) {
          var next = Object.assign({}, seg);
          next.text = part;
          out.push(next);
        });
      });
      return out;
    }
