// GPT-SoVITS Tavo runtime part: 50_settings_voice_picker.js // Source: static/tavo.runtime.js lines 3601-4550 before physical split. // Role: settings panel, role voice mapping, voice picker // This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script. 
    function isDialogOpen(d) {
      return !!(d && (d.open || (d.hasAttribute && d.hasAttribute("open")) || (d.getAttribute && d.getAttribute("data-open") === "1")));
    }
    async function refreshCharacterConfig(opts) {
      opts = opts || {};
      if (opts.skipIfEditing && isDialogOpen(panel)) return false;
      var charCfg = null;
      try { charCfg = await loadCharacterCfg(characterId); } catch (_) { charCfg = null; }
      if (!charCfg || typeof charCfg !== "object") return false;
      var changed = false;
      if (typeof charCfg.defaultVoice === "string" && charCfg.defaultVoice !== cfg.defaultVoice) {
        cfg.defaultVoice = charCfg.defaultVoice;
        changed = true;
      }
      if (Array.isArray(charCfg.roleVoiceList) && charCfg.roleVoiceList.length) {
        var nextList = normalizeRoleVoiceList(charCfg.roleVoiceList, cfg.currentCharacterName, charCfg.characterName);
        if (JSON.stringify(nextList) !== JSON.stringify(normalizeRoleVoiceList(cfg.roleVoiceList || [], cfg.currentCharacterName))) {
          cfg.roleVoiceList = nextList;
          changed = true;
        }
      }
      if (changed || opts.forceSync) syncUI();
      return changed;
    }
    function roleVoice(roleName) {
      roleName = String(roleName || "").trim();
      var list = normalizeRoleVoiceList(cfg.roleVoiceList || [], cfg.currentCharacterName);
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].role || "").trim() === roleName) return String(list[i].voice || "").trim();
      }
      return "";
    }
    function validateVoiceMappingForGenerate() {
      if (cfg.mode === "single") {
        return cfg.defaultVoice ? "" : "请先在“音色选择”里选择单音色音色。";
      }
      var missing = [];
      var list = normalizeRoleVoiceList(cfg.roleVoiceList || [], cfg.currentCharacterName);
      ["旁白", "用户"].forEach(function (name) {
        if (!roleVoice(name)) missing.push(name);
      });
      list.forEach(function (r) {
        var role = String((r && r.role) || "").trim();
        if (!role || role === "旁白" || role === "用户") return;
        if (!String(r.voice || "").trim()) missing.push(role);
      });
      if (missing.length) return "请先在“角色音色映射”里给这些角色选择音色：" + missing.join("、") + "。";
      return "";
    }
    function modeName() { return cfg.mode === "ai8" ? "多音色" : "单音色"; }
    function syncUI() {
      setField("apiBase", cfg.apiBase || scriptOrigin());
      setField("intervalMs", Number(cfg.intervalMs || 50));
      setField("llmModel", cfg.llmModel || "");
      setField("llmEndpoint", cfg.llmEndpoint || "");
      setField("llmApiKey", cfg.llmApiKey || "");
      setCheckedField("reuseLlmParse", cfg.reuseLlmParse !== false);
      setField("speedFactor", cfg.speedFactor || 1.0);
      setField("qualityMode", cfg.qualityMode || "balanced");
      setCheckedField("offlineAudioEnabled", cfg.offlineAudioEnabled);
      try { audio.playbackRate = clampNumber(cfg.speedFactor || 1.0, 1.0, 0.85, 1.25); } catch (_) {}
      renderRoleList();
      // 多音色拆段设置只在该模式下显示；单音色配置反之
      try {
        var ai8Show = (cfg.mode === "ai8");
        $all(panel, '.idx-ai8-only').forEach(function (el) { el.style.display = ai8Show ? "" : "none"; });
        $all(panel, '.idx-single-only').forEach(function (el) { el.style.display = ai8Show ? "none" : ""; });
      } catch (_) {}
      // 当前 mode 按钮高亮
      try {
        $all(panel, '.idx-mode').forEach(function (b) {
          if (b.dataset.mode === cfg.mode) b.setAttribute("data-active", "1"); else b.removeAttribute("data-active");
        });
      } catch (_) {}
      if (voicePill) voicePill.textContent = "音色：" + shortName(cfg.defaultVoice);
      if (modePill) modePill.textContent = "模式：" + modeName();
      if (title) title.textContent = (context && context.characterName ? context.characterName : shortName(cfg.defaultVoice));
      if (cover) {
        if (avatarUrl) {
          cover.textContent = "";
          cover.style.backgroundImage = "url(\"" + String(avatarUrl).replace(/"/g, "%22") + "\")";
          cover.style.backgroundSize = "cover";
          cover.style.backgroundPosition = "center";
        } else {
          cover.style.backgroundImage = "";
          cover.textContent = (context && context.characterName ? context.characterName : shortName(cfg.defaultVoice)).slice(0, 1) || "";
        }
      }
      $all(panel, '.idx-mode').forEach(function (b) { b.classList.toggle('is-active', b.dataset.mode === cfg.mode); });
      $all(panel, '.idx-voice').forEach(function (b) { b.classList.toggle('is-active', b.dataset.voice === cfg.defaultVoice); });
    }
