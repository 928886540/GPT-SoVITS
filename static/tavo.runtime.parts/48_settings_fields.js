// GPT-SoVITS Tavo runtime part: 48_settings_fields.js
// Role: settings field helpers and readFields.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    function findInWidget(sel) { return $(root, sel) || $(panel, sel); }
    function field(name) { return findInWidget('[data-field="' + name + '"]'); }
    // IME-safe setField：用户正在输入或中文输入法组词时，不覆盖 input.value，
    // 否则搜狗/微软等 IME 的候选词会被清掉，导致打不进字。
    function setField(name, value) {
      var el = field(name); if (!el) return;
      if (document.activeElement === el) return;            // 正在输入
      if (el.__sovitsComposing) return;                      // 中文输入法组词中
      var v = value == null ? "" : value;
      if (el.value !== String(v)) el.value = v;
    }
    function getField(name, fallback) { var el = field(name); return el ? el.value : fallback; }
    function setCheckedField(name, value) { var el = field(name); if (el) el.checked = !!value; }
    function getCheckedField(name, fallback) { var el = field(name); return el ? !!el.checked : !!fallback; }
    function clampNumber(value, fallback, min, max) {
      var n = Number(value);
      if (!isFinite(n)) n = fallback;
      return Math.max(min, Math.min(max, n));
    }
    function readFields() {
      cfg.apiBase = String(getField("apiBase", cfg.apiBase || scriptOrigin())).trim() || scriptOrigin();
      cfg.intervalMs = Number(getField("intervalMs", cfg.intervalMs || 50) || 50);
      cfg.speedFactor = clampNumber(getField("speedFactor", cfg.speedFactor || 1.0), 1.0, 0.85, 1.25);
      cfg.qualityMode = String(getField("qualityMode", cfg.qualityMode || "balanced") || "balanced").trim();
      if (["fast", "balanced", "expressive", "ultra"].indexOf(cfg.qualityMode) < 0) cfg.qualityMode = "balanced";
      cfg.offlineAudioEnabled = getCheckedField("offlineAudioEnabled", cfg.offlineAudioEnabled);
      try { audio.playbackRate = cfg.speedFactor; } catch (_) {}
      // cfg.roleVoiceList 由 renderRoleList 实时维护(addRoleRow/setRowVoice 等),
      // 这里把行里的角色名/音色同步抓一遍(防止用户没失焦就保存)。
      var rows = $all(panel, '.idx-role-row');
      var newList = [];
      rows.forEach(function (row) {
        var nameEl = first(row, '.idx-role-name');
        var role = nameEl ? String(nameEl.value || "").trim() : "";
        var voice = row.dataset.voice || "";
        if (role || voice) newList.push({ role: role, voice: voice });
      });
      if (newList.length) cfg.roleVoiceList = newList;
      cfg.roleVoicesText = serializeRoleVoiceList(cfg.roleVoiceList);  // 同步序列化兜底
      cfg.llmModel = String(getField("llmModel", cfg.llmModel || "")).trim();
      cfg.llmEndpoint = String(getField("llmEndpoint", cfg.llmEndpoint || "")).trim();
      cfg.llmApiKey = String(getField("llmApiKey", cfg.llmApiKey || "")).trim();
      cfg.reuseLlmParse = getCheckedField("reuseLlmParse", cfg.reuseLlmParse !== false);
    }
