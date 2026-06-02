// GPT-SoVITS Tavo runtime part: 36_track_state_offline.js
// Role: track state machine helpers and offline audio hydration/storage.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    function oneOf(value, list, fallback) {
      value = String(value || "").trim();
      return list.indexOf(value) >= 0 ? value : fallback;
    }
    function inferLegacyTrackState(track) {
      if (!track) return "pending";
      if (track.status === "failed" || track.serverState === "failed" || track.cacheState === "failed" || track.remoteCacheState === "failed") return "failed";
      if (track.cacheReady || track.fromHistory || track.status === "ready" || track.cacheState === "ready" || track.remoteCacheState === "ready" || (track.url && !track.streaming && !track.pendingBlob)) return "saved";
      if (track.streamUrl || track.streaming || track.status === "running" || track.serverState === "running" || track.pendingBlob) return "live";
      return "pending";
    }
    function ensureTrackStates(track) {
      if (!track) return null;
      var state = oneOf(track.state, ["pending", "live", "saved", "failed"], inferLegacyTrackState(track));
      track.state = state; // legacy coarse state, persisted for old cards.
      track.serverState = oneOf(track.serverState, ["pending", "running", "done", "failed"],
        state === "saved" ? "done" : (state === "failed" ? "failed" : (state === "live" ? "running" : "pending")));
      var cacheState = track.cacheState || track.remoteCacheState;
      track.cacheState = oneOf(cacheState, ["none", "pending", "ready", "failed", "missing"],
        state === "saved" ? "ready" : (state === "failed" ? "failed" : ((track.cacheKey || track.cacheUrl) ? "pending" : "none")));
      track.remoteCacheState = track.cacheState;
      track.offlineState = !cfg.offlineAudioEnabled ? "disabled" : oneOf(track.offlineState, ["missing", "saving", "ready", "failed"],
        (track.offlineReady || track.offlineUrl) ? "ready" : (track.offlineSaveInProgress ? "saving" : "missing"));
      track.streamHealth = oneOf(track.streamHealth, ["ok", "stalled", "interrupted"],
        track.streamInterrupted ? "interrupted" : (track.streamStalled ? "stalled" : "ok"));
      if (track.stalledCount == null) track.stalledCount = 0;
      return track;
    }
    function setTrackPlaybackState(track, state) {
      if (!track) return "";
      ensureTrackStates(track);
      track.playbackState = oneOf(state, ["idle", "loading", "streaming", "playing", "buffering", "paused", "ended", "error"], "idle");
      return track.playbackState;
    }
    function setTrackServerState(track, state) {
      if (!track) return "";
      ensureTrackStates(track);
      track.serverState = oneOf(state, ["pending", "running", "done", "failed"], "pending");
      return track.serverState;
    }
    function setTrackCacheState(track, state) {
      if (!track) return "";
      ensureTrackStates(track);
      track.cacheState = oneOf(state, ["none", "pending", "ready", "failed", "missing"], "none");
      track.remoteCacheState = track.cacheState;
      if (track.cacheState === "ready") track.cacheReady = true;
      return track.cacheState;
    }
    function setTrackOfflineState(track, state) {
      if (!track) return "";
      ensureTrackStates(track);
      track.offlineState = !cfg.offlineAudioEnabled ? "disabled" : oneOf(state, ["missing", "saving", "ready", "failed"], "missing");
      return track.offlineState;
    }
    function setTrackStreamHealth(track, state) {
      if (!track) return "";
      ensureTrackStates(track);
      track.streamHealth = oneOf(state, ["ok", "stalled", "interrupted"], "ok");
      if (track.streamHealth === "ok") {
        track.streamInterrupted = false;
        track.streamStalled = false;
      } else if (track.streamHealth === "interrupted") {
        track.streamInterrupted = true;
        track.streamStalled = true;
      } else {
        track.streamStalled = true;
      }
      return track.streamHealth;
    }
    function setTrackState(track, state) {
      if (!track) return "";
      state = oneOf(state, ["pending", "live", "saved", "failed"], "pending");
      track.state = state;
      if (state === "saved") {
        track.status = "ready";
        track.pendingBlob = false;
        track.streaming = false;
        if (track.cacheUrl || track.fromHistory || track.url) track.cacheReady = true;
        setTrackServerState(track, "done");
        setTrackCacheState(track, "ready");
        if (!track.playbackState || track.playbackState === "loading" || track.playbackState === "streaming") setTrackPlaybackState(track, "idle");
      } else if (state === "live") {
        track.status = "running";
        track.pendingBlob = true;
        track.streaming = true;
        setTrackServerState(track, "running");
        setTrackCacheState(track, (track.cacheKey || track.cacheUrl) ? "pending" : "none");
        if (!track.playbackState || track.playbackState === "idle") setTrackPlaybackState(track, "streaming");
      } else if (state === "failed") {
        track.status = "failed";
        track.pendingBlob = false;
        track.streaming = false;
        setTrackServerState(track, "failed");
        setTrackCacheState(track, "failed");
        setTrackPlaybackState(track, "error");
      } else {
        track.status = "pending";
        track.pendingBlob = true;
        setTrackServerState(track, "pending");
        setTrackCacheState(track, (track.cacheKey || track.cacheUrl) ? "pending" : "none");
        if (!track.playbackState) setTrackPlaybackState(track, "loading");
      }
      ensureTrackStates(track);
      return state;
    }
    function trackState(track) {
      if (!track) return "pending";
      ensureTrackStates(track);
      return track.state;
    }
    function isSavedTrack(track) { return trackState(track) === "saved"; }
    function isLiveTrack(track) { return trackState(track) === "live"; }
    function trackPlayableUrl(track) {
      if (!track) return "";
      if (cfg.offlineAudioEnabled && track.offlineUrl) return track.offlineUrl;
      if (isSavedTrack(track)) return track.url || track.cacheUrl || track.streamUrl || "";
      if (track.backgroundOnly) return "";
      if (isLiveTrack(track)) return track.streamUrl || track.url || "";
      return track.url || "";
    }
    function liveStreamUrlForTrack(track) {
      if (!track) return "";
      if (track.streamUrl) return track.streamUrl;
      if (track.mode !== "single" && track.cacheKey) {
        track.streamUrl = cleanBase(cfg.apiBase) + "/tts_dialogue_stream_job/" + encodeURIComponent(track.cacheKey);
        return track.streamUrl;
      }
      return track.url || "";
    }
    function liveStreamPlaybackUrlForTrack(track, startOffsetSec) {
      var url = liveStreamUrlForTrack(track);
      if (!url) return "";
      startOffsetSec = Math.max(0, Number(startOffsetSec || 0) || 0);
      return startOffsetSec > 0.01 ? withQueryParam(url, "start_s", startOffsetSec.toFixed(3)) : url;
    }
    function isElementUsingTrackStream(track) {
      if (!track || !track.streamUrl) return false;
      try {
        if (track.cacheKey && audio.dataset.idxCacheKey === String(track.cacheKey) && audio.dataset.idxSourceKind === "stream") return true;
      } catch (_) {}
      var src = audio.currentSrc || audio.src || "";
      return src === track.streamUrl;
    }
    function isElementPlayingTrackStream(track) {
      return !!(isElementUsingTrackStream(track) && !audio.paused && !audio.ended);
    }
    function trackHasStreamIssue(track) {
      if (!track) return false;
      ensureTrackStates(track);
      return !!(track.streamInterrupted || track.streamHealth === "interrupted" || track.streamHealth === "stalled" || Number(track.stalledCount || 0) > 0);
    }
    function trackShouldAskPlaySaved(track) {
      if (!track) return false;
      ensureTrackStates(track);
      return !!(track.streamInterrupted || track.streamHealth === "interrupted" || Number(track.stalledCount || 0) > 2);
    }
    function revokeOfflineObjectUrl(track) {
      if (track && track.offlineObjectUrl) {
        try { URL.revokeObjectURL(track.offlineObjectUrl); } catch (_) {}
        track.offlineObjectUrl = "";
        if (track.offlineUrl && /^blob:/i.test(track.offlineUrl)) track.offlineUrl = "";
      }
    }
    function ensureTrackOfflineKey(track) {
      if (!track) return "";
      if (!track.offlineKey) track.offlineKey = offlineAudioKey(track.cacheKey);
      return track.offlineKey || "";
    }
    async function hydrateOfflineAudio(track, label) {
      if (!cfg.offlineAudioEnabled || !track || !track.cacheKey) {
        if (track) setTrackOfflineState(track, cfg.offlineAudioEnabled ? "missing" : "disabled");
        return false;
      }
      if (track.offlineReady && track.offlineUrl && /^blob:/i.test(String(track.offlineUrl))) {
        setTrackOfflineState(track, "ready");
        return true;
      }
      var key = ensureTrackOfflineKey(track);
      if (!key) return false;
      var rec = await getOfflineAudioRecord(key);
      if (!rec || !rec.blob) {
        track.offlineReady = false;
        setTrackOfflineState(track, "missing");
        return false;
      }
      revokeOfflineObjectUrl(track);
      track.offlineUrl = URL.createObjectURL(rec.blob);
      track.offlineObjectUrl = track.offlineUrl;
      track.offlineReady = true;
      track.offlineWanted = false;
      track.offlineSavedAt = rec.updatedAt || rec.createdAt || Date.now();
      track.offlineSize = rec.size || (rec.blob && rec.blob.size) || 0;
      setTrackOfflineState(track, "ready");
      debugLog("📦 " + (label || "offline") + " 命中 IndexedDB: " + key, "#9f9");
      return true;
    }
    async function saveOfflineAudioForTrack(track, label) {
      if (!cfg.offlineAudioEnabled || !track || !track.cacheKey || !track.cacheUrl || track.offlineSaveInProgress) {
        if (track) setTrackOfflineState(track, cfg.offlineAudioEnabled ? "missing" : "disabled");
        return false;
      }
      var key = ensureTrackOfflineKey(track);
      if (!key) return false;
      track.offlineSaveInProgress = true;
      setTrackOfflineState(track, "saving");
      try {
        var existing = await getOfflineAudioRecord(key);
        if (existing && existing.blob) {
          await hydrateOfflineAudio(track, label || "offline");
          if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
          return true;
        }
        var res = await fetch(track.cacheUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var blob = await res.blob();
        if (!blob || !blob.size) throw new Error("空音频");
        var now = Date.now();
        await putOfflineAudioRecord({
          key: key,
          cacheKey: track.cacheKey,
          sourceUrl: track.cacheUrl,
          mode: track.mode || "",
          voice: track.voice || "",
          contentType: blob.type || "audio/wav",
          size: blob.size,
          blob: blob,
          createdAt: track.offlineSavedAt || now,
          updatedAt: now
        });
        revokeOfflineObjectUrl(track);
        track.offlineUrl = URL.createObjectURL(blob);
        track.offlineObjectUrl = track.offlineUrl;
        track.offlineReady = true;
        track.offlineWanted = false;
        track.offlineSavedAt = now;
        track.offlineSize = blob.size;
        setTrackOfflineState(track, "ready");
        if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
      debugLog("💾 " + (label || "offline") + " 已保存本机缓存音频: " + key + " (" + Math.round(blob.size / 1024) + " KB)", "#9f9");
        return true;
      } catch (e) {
        track.offlineWanted = true;
        setTrackOfflineState(track, "failed");
        debugLog("⚠️ " + (label || "offline") + " 本机缓存副本保存失败，在线播放不受影响: " + errorMessage(e, "网络请求失败"), "#fc9");
        if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
        return false;
      } finally {
        track.offlineSaveInProgress = false;
      }
    }
    function scheduleOfflineAudioSave(track, label, delayMs) {
      if (!cfg.offlineAudioEnabled || !track || !track.cacheKey || !track.cacheUrl || track.offlineReady || track.offlineSaveInProgress || track.offlineSaveTimer) return;
      track.offlineWanted = true;
      setTrackOfflineState(track, "missing");
      track.offlineSaveTimer = setTimeout(function () {
        track.offlineSaveTimer = null;
        saveOfflineAudioForTrack(track, label).catch(function(){});
      }, Math.max(0, Number(delayMs || 0) || 0));
    }
    async function prepareOfflineAudio(track, label) {
      if (!cfg.offlineAudioEnabled || !track) return false;
      var hit = await hydrateOfflineAudio(track, label);
      var opts = (arguments.length > 2 && arguments[2]) || {};
      if (!hit && opts.saveMissing && isSavedTrack(track) && track.cacheKey && track.cacheUrl) {
        scheduleOfflineAudioSave(track, (label || "offline") + " compensation", 0);
      }
      return hit;
    }
    async function deleteOfflineAudioForTrack(track) {
      if (!track) return false;
      var key = ensureTrackOfflineKey(track);
      revokeOfflineObjectUrl(track);
      if (!key) return false;
      var ok = await deleteOfflineAudioRecord(key);
      if (ok) {
        track.offlineReady = false;
        track.offlineWanted = false;
        setTrackOfflineState(track, cfg.offlineAudioEnabled ? "missing" : "disabled");
        debugLog("🗑 已删除本机缓存音频: " + key, "#fc9");
      }
      return ok;
    }
    function shouldUseWebAudioForLiveTrack(track) {
      if (!(track && track.mode === "ai8" && isLiveTrack(track) && (track.streamUrl || track.cacheKey))) return false;
      if (track.forceWebAudioLive || track.elementAudioUnsupported) return true;
      if (isMobileUA()) return true;
      try {
        if (script && script.src && /[?&]webAudioLive=1\b/.test(script.src)) return true;
      } catch (_) {}
      return false;
    }
    function shouldUseWebAudioForSavedTrack(track) {
      if (!(track && isSavedTrack(track))) return false;
      if (track.forceElementAudio) return false;
      if (track.elementAudioUnsupported) return true;
      try {
        if (script && script.src && /[?&]webAudioSaved=0\b/.test(script.src)) return false;
        if (script && script.src && /[?&]webAudioSaved=1\b/.test(script.src)) return true;
      } catch (_) {}
      return isMobileUA();
    }
    function shouldUseElementForSavedTrack(track) {
      return isSavedTrack(track);
    }
    function savedTrackLabel(track) {
      return shouldUseElementForSavedTrack(track) ? "音频已保存" : "音频已就绪";
    }
    function waitingLabelForTrack(track) {
      if (shouldUseElementForSavedTrack(track)) return "缓冲中…";
      if (track && track.mode === "single") return "正在生成单音色音频…";
      return "正在等待音频…";
    }
    function qualityModeLabel(mode) {
      mode = String(mode || "");
      if (mode === "fast") return "极速";
      if (mode === "balanced") return "标准";
      if (mode === "expressive") return "质量优先";
      if (mode === "ultra") return "极限质量";
      return "标准";
    }
    function formatJobMetrics(metrics) {
      if (!metrics) return "";
      function num(v) { v = Number(v); return isFinite(v) ? v : null; }
      var parts = [];
      var first = num(metrics.first_pcm_s);
      var total = num(metrics.total_wall_s);
      var dur = num(metrics.audio_duration_s);
      var rtf = num(metrics.rtf);
      var wallRtf = num(metrics.wall_rtf);
      var steps = num(metrics.diffusion_steps);
      var firstTokens = num(metrics.first_tokens);
      var s2mel = num(metrics.s2mel_s);
      var condition = num(metrics.condition_s);
      var done = num(metrics.segments_done);
      var all = num(metrics.segments_total);
      if (metrics.performance_mode) parts.push("档位 " + qualityModeLabel(metrics.performance_mode));
      if (steps != null) parts.push("steps " + steps);
      if (firstTokens != null) parts.push("首段 " + firstTokens);
      if (first != null) parts.push("首音 " + first.toFixed(1) + "s");
      if (rtf != null) parts.push("RTF " + rtf.toFixed(2));
      if (wallRtf != null && wallRtf !== rtf) parts.push("全程RTF " + wallRtf.toFixed(2));
      if (s2mel != null && s2mel > 0) parts.push("s2mel " + s2mel.toFixed(1) + "s");
      if (condition != null && condition > 0) parts.push("条件 " + condition.toFixed(1) + "s");
      if (dur != null && dur > 0) parts.push("音频 " + dur.toFixed(1) + "s");
      if (total != null) parts.push("总耗时 " + total.toFixed(1) + "s");
      if (done != null && all != null && all > 0) parts.push("段 " + done + "/" + all);
      return parts.join(" · ");
    }
