;(function () {
  "use strict";

  var loaderScript = (typeof window !== "undefined" && window.__gptsovits_tavo_runtime_script_override) || document.currentScript;
  var RUNTIME_PARTS_VERSION = "20260601-split-runtime-v4";
  var PARTS = [
    "tavo.runtime.parts/00_base_config_storage.js",
    "tavo.runtime.parts/05_message_text_config.js",
    "tavo.runtime.parts/10_tts_jobs_audio_stream.js",
    "tavo.runtime.parts/20_llm_segmentation.js",
    "tavo.runtime.parts/25_ui_templates.js",
    "tavo.runtime.parts/30_player_shell.js",
    "tavo.runtime.parts/32_llm_reuse_helpers.js",
    "tavo.runtime.parts/34_element_audio_controls.js",
    "tavo.runtime.parts/36_track_state_offline.js",
    "tavo.runtime.parts/38_saved_prompt_stream_helpers.js",
    "tavo.runtime.parts/40_playback_cache.js",
    "tavo.runtime.parts/42_saved_playback_cache.js",
    "tavo.runtime.parts/44_track_history_cache.js",
    "tavo.runtime.parts/48_settings_fields.js",
    "tavo.runtime.parts/50_settings_voice_picker.js",
    "tavo.runtime.parts/52_voice_subtitle_media.js",
    "tavo.runtime.parts/54_voice_picker_panel.js",
    "tavo.runtime.parts/58_live_pause_helper.js",
    "tavo.runtime.parts/60_generate_mount_boot.js",
    "tavo.runtime.parts/62_dialog_audio_events.js",
    "tavo.runtime.parts/68_mount_boot.js"
  ];

  function runtimeBaseUrl() {
    try {
      if (loaderScript && loaderScript.src) return new URL(".", loaderScript.src).href;
    } catch (_) {}
    try { return new URL("/static/", location.href).href; } catch (_) { return ""; }
  }

  function withVersion(url) {
    try {
      var u = new URL(url, location.href);
      u.searchParams.set("runtime_part_v", RUNTIME_PARTS_VERSION);
      return u.href;
    } catch (_) {
      var sep = String(url || "").indexOf("?") >= 0 ? "&" : "?";
      return String(url || "") + sep + "runtime_part_v=" + encodeURIComponent(RUNTIME_PARTS_VERSION);
    }
  }

  function partUrl(name) {
    try { return withVersion(new URL(name, runtimeBaseUrl()).href); }
    catch (_) { return withVersion(runtimeBaseUrl() + name); }
  }

  function fetchPart(name) {
    var url = partUrl(name);
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("runtime part load failed: " + res.status + " " + url);
      return res.text().then(function (text) {
        return "\n\n/* ---- " + name + " ---- */\n" + text;
      });
    });
  }

  function executeRuntime(source) {
    var previousOverride;
    try { previousOverride = window.__gptsovits_tavo_runtime_script_override; } catch (_) { previousOverride = undefined; }
    try { window.__gptsovits_tavo_runtime_script_override = loaderScript; } catch (_) {}
    try {
      // The parts are slices of one async IIFE. Execute them as one source so existing
      // closure-scoped state, lazy mount behavior, and iOS gesture logic stay unchanged.
      (0, eval)(source + "\n//# sourceURL=gptsovits-tavo-runtime.parts.js");
      var appPromise = null;
      try { appPromise = window.__gptsovits_tavo_runtime_app_promise; } catch (_) {}
      if (appPromise && typeof appPromise.then === "function") return appPromise;
      return true;
    } finally {
      try {
        if (previousOverride === undefined) delete window.__gptsovits_tavo_runtime_script_override;
        else window.__gptsovits_tavo_runtime_script_override = previousOverride;
      } catch (_) {}
    }
  }

  window.__gptsovits_tavo_runtime_ready = Promise.all(PARTS.map(fetchPart)).then(function (parts) {
    return executeRuntime(parts.join("\n"));
  }).catch(function (err) {
    try { console.error("[GPT-SoVITS TAVO runtime loader]", err && err.stack ? err.stack : err); } catch (_) {}
    throw err;
  });
})();
