// GPT-SoVITS Tavo runtime part: 68_mount_boot.js
// Role: lazy full-player mount and runtime bootstrap.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
  function mount(root, cfg, context) {
    var messageId = context && context.messageId ? context.messageId : "";
    var characterName = (context && context.characterName) || shortName(cfg.defaultVoice) || "语音";
    var latest = latestLocalTrackForMessage(messageId);
    var historyCount = messageId ? localHistoryCountForMessage(messageId) : 0;
    var resumeSec = latest ? Math.max(0, Number(latest.lastElementSec || latest.lastWebAudioSec || 0) || 0) : 0;
    renderRuntimeLazyShell(root, characterName, latest, historyCount, resumeSec);
    var mounted = false;
    var mounting = null;
    async function ensureFull() {
      if (mounted) return true;
      if (mounting) return mounting;
      mounting = Promise.resolve().then(function () {
        mountFull(root, cfg, context);
        mounted = true;
        root.setAttribute("data-player-mounted", "1");
        return true;
      }).finally(function () { mounting = null; });
      return mounting;
    }
    function clickFull(sel) {
      ensureFull().then(function () {
        var btn = first(root, sel);
        if (btn) btn.click();
      }).catch(function (e) { try { console.error("[sovits tavo] lazy mount", e); } catch (_) {} });
    }
    on(first(root, '[data-role="lazy-play"]'), 'click', function (ev) { ev.preventDefault(); clickFull('[data-role="play"]'); });
    on(first(root, '[data-role="lazy-gear"]'), 'click', function (ev) { ev.preventDefault(); clickFull('[data-role="gear"]'); });
    on(first(root, '[data-role="lazy-open"]'), 'click', function (ev) { ev.preventDefault(); ensureFull(); });
    on(first(root, '[data-role="lazy-open"]'), 'keydown', function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ensureFull(); } });
  }

  try {
    await ensureStyle();
    removeLegacyGlobalGear();
    if (script && (script.dataset.sovitsMounted === "1" || script.dataset[LEGACY_PRODUCT_KEY + "Mounted"] === "1")) return;
    if (script) script.dataset.sovitsMounted = "1";
    var msgEl = messageElement(script);
    if (msgEl && msgEl !== document.body && msgEl !== document.documentElement) {
      $all(msgEl, '.idx-tts').forEach(function (node) { if (node.parentNode) node.parentNode.removeChild(node); });
    }
    var root = document.createElement("div");
    root.className = "idx-tts";
    if (script && script.parentNode) script.parentNode.insertBefore(root, script.nextSibling); else document.body.appendChild(root);
    var cfg = await getConfig();
    var ctx = await currentMessageContext();
    cfg.currentCharacterName = ctx.characterName || "";
    // 角色级 defaultVoice + roleVoiceList 覆盖全局 cfg。
    // 优先读 TAVO character scope；ctx.characterId 只用于旧版全局 key/localStorage 迁移。
    try {
      var charCfg = await loadCharacterCfg(ctx.characterId);
      if (charCfg) {
        if (typeof charCfg.defaultVoice === "string") cfg.defaultVoice = charCfg.defaultVoice;
        if (!cfg.defaultVoice && Array.isArray(charCfg.roleVoiceList)) {
          cfg.defaultVoice = voiceForRoleNames(charCfg.roleVoiceList, ["角色", "character", "当前角色", cfg.currentCharacterName], cfg.currentCharacterName, charCfg.characterName) || cfg.defaultVoice;
        }
        if (Array.isArray(charCfg.roleVoiceList) && charCfg.roleVoiceList.length) cfg.roleVoiceList = normalizeRoleVoiceList(charCfg.roleVoiceList, cfg.currentCharacterName, charCfg.characterName);
      }
    } catch (_) {}
    // 关键:过滤掉历史会话累积的多余空行,确保前 2 行 reserved
    cfg.roleVoiceList = normalizeRoleVoiceList(cfg.roleVoiceList, cfg.currentCharacterName);
    mountFull(root, cfg, ctx);
  } catch (e) { try { console.error("[sovits tavo]", e && e.stack ? e.stack : (e && e.message ? e.message : JSON.stringify(e))); } catch (_) {} }
})();
