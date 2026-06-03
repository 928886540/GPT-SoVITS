// GPT-SoVITS Tavo runtime part: 42_saved_playback_cache.js
// Role: saved-track status, decoded-buffer playback, and saved audio availability.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    async function refreshTrackFromStatus(track, label) {
      if (!track || !track.cacheKey || track.deleted) return false;
      try {
        if (track.mode === "single") {
          if (!track.cacheUrl) track.cacheUrl = cleanBase(cfg.apiBase) + "/cache_audio/" + encodeURIComponent(track.cacheKey);
          var hs = await fetch(track.cacheUrl, { method: "HEAD", cache: "no-store" });
          if (!hs.ok) {
            if (hs.status === 404 || hs.status === 410) markTrackCacheMissing(track, label || "single");
            return false;
          }
          setTrackState(track, "saved");
          attachCacheAudio(track, { deferElement: true });
          scheduleOfflineAudioSave(track, (label || "single") + " offline", 0);
          if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
          debugLog("✅ " + (label || "single") + " 单音色缓存已保存", "#9f9");
          return true;
        }
        var st = await fetch(cleanBase(cfg.apiBase) + "/tts_dialogue_job_status/" + encodeURIComponent(track.cacheKey), { cache: "no-store" });
        if (!st.ok) return false;
        var j = await st.json();
        if (j && j.metrics) track.metrics = j.metrics;
        if (j && j.sample_rate) track.sampleRate = j.sample_rate;
        if (j && j.duration_s) track.duration_s = j.duration_s;
        if (j && j.cache_url) track.cacheUrl = new URL(j.cache_url, cleanBase(cfg.apiBase) + "/").href;
        if (j && Array.isArray(j.segments_meta) && j.segments_meta.length) {
          track.segments = j.segments_meta.map(function (s) {
            return { role: s.role || "", text: s.text || "", style: s.style || "neutral", style_alpha: s.style_alpha, start_s: s.start_s, start_offset_bytes: s.start_offset_bytes, duration_s: s.duration_s };
          });
        }
        if (j && j.state === "done") {
          var savedLogKey = (label || "track") + ":" + track.cacheKey;
          setTrackState(track, "saved");
          attachCacheAudio(track, { deferElement: true });
          scheduleOfflineAudioSave(track, (label || "track") + " offline", 0);
          if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
          if (track.lastSavedLogKey !== savedLogKey) {
            track.lastSavedLogKey = savedLogKey;
            debugLog("✅ " + (label || "track") + " 已保存，切换为历史音频", "#9f9");
          }
          return true;
        }
        if (j && j.state === "failed") {
          applyServerJobFailure(track, j.error, { title: "服务端推理失败" });
          return true;
        }
        if (j && j.state === "missing") {
          markTrackCacheMissing(track, label || "track");
          return false;
        }
      } catch (e) {
        debugLog("⚠️ 检查历史音频状态失败: " + errorMessage(e, "网络请求失败"), "#fc9");
      }
      return false;
    }
    function markTrackCacheMissing(track, label) {
      if (!track) return;
      track.url = "";
      track.cacheReady = false;
      track.pendingBlob = false;
      track.streaming = false;
      track.error = "历史音频缓存不存在或任务已失效，请点 + 重新生成。";
      setTrackState(track, "failed");
      setTrackCacheState(track, "missing");
      setTrackServerState(track, "failed");
      setTrackPlaybackState(track, "error");
      setPlayState("idle");
      setStatus("历史音频已失效");
      showTrackNotice(track, "历史音频已失效", "本机 cache 文件不存在，点 + 重新生成");
      debugLog("⚠️ " + (label || "track") + " cache missing cacheKey=" + (track.cacheKey || ""), "#fc9");
      if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
    }
    async function verifySavedTrackAvailable(track, label) {
      if (!track || !isSavedTrack(track)) return false;
      if (cfg.offlineAudioEnabled && track.offlineUrl) return true;
      if (!track.cacheKey || !track.cacheUrl) return !!trackPlayableUrl(track);
      if (track.mode === "single") {
        try {
          var hs = await fetch(track.cacheUrl, { method: "HEAD", cache: "no-store" });
          if (hs.ok) return true;
          if (hs.status === 404 || hs.status === 410) markTrackCacheMissing(track, label || "saved");
          return false;
        } catch (e) {
          debugLog("⚠️ " + (label || "saved") + " HEAD 失败: " + errorMessage(e, "网络请求失败"), "#fc9");
          return true;
        }
      }
      try {
        var st = await fetch(cleanBase(cfg.apiBase) + "/tts_dialogue_job_status/" + encodeURIComponent(track.cacheKey), { cache: "no-store" });
        if (!st.ok) {
          if (st.status === 404 || st.status === 410) markTrackCacheMissing(track, label || "saved");
          return false;
        }
        var j = await st.json();
        if (j && j.metrics) track.metrics = j.metrics;
        if (j && j.sample_rate) track.sampleRate = j.sample_rate;
        if (j && j.duration_s) track.duration_s = j.duration_s;
        if (j && j.cache_url) track.cacheUrl = new URL(j.cache_url, cleanBase(cfg.apiBase) + "/").href;
        if (j && Array.isArray(j.segments_meta) && j.segments_meta.length) {
          track.segments = j.segments_meta.map(function (s) {
            return { role: s.role || "", text: s.text || "", style: s.style || "neutral", style_alpha: s.style_alpha, start_s: s.start_s, start_offset_bytes: s.start_offset_bytes, duration_s: s.duration_s };
          });
        }
        if (j && j.state === "done" && j.cache_url) {
          setTrackState(track, "saved");
          return true;
        }
        if (j && (j.state === "missing" || (!j.cached && !j.cache_url && j.state === "pending"))) {
          markTrackCacheMissing(track, label || "saved");
          return false;
        }
        if (j && j.state === "failed") {
          applyServerJobFailure(track, j.error, { title: "服务端推理失败" });
          return false;
        }
        setTrackState(track, "live");
        pollCacheUpgrade(track, (label || "saved") + " recover");
        setStatus("音频仍在生成中…");
        showTrackNotice(track, "音频仍在生成中…", "完成后会自动切回历史音频");
        return false;
      } catch (e) {
        debugLog("⚠️ " + (label || "saved") + " 状态确认失败: " + errorMessage(e, "网络请求失败"), "#fc9");
        return true;
      }
    }
    async function decodedBufferForSavedTrack(track, url, label) {
      if (track.decodedAudioBuffer && track.decodedAudioBufferUrl === url) return track.decodedAudioBuffer;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("浏览器不支持 Web Audio API");
      var ctx = PRIMED_CTX || new AC();
      PRIMED_CTX = ctx;
      try { if (ctx.state === "suspended") await ctx.resume(); }
      catch (e) { throw new Error("[step:resume] " + errorMessage(e, "AudioContext resume 失败")); }
      if (String(ctx.state || "running") !== "running") {
        throw (typeof audioContextBlockedError === "function" ? audioContextBlockedError("resume", ctx) : new Error("[step:resume] AudioContext state=" + String(ctx.state || "unknown") + "，音频通道未放行"));
      }
      setStatus(url === track.offlineUrl ? "读取本机缓存…" : "读取已保存音频…");
      showTrackNotice(track, url === track.offlineUrl ? "读取本机缓存…" : "读取已保存音频…", label || "首次读取后拖动进度不会重新请求音频");
      var res;
      try { res = await fetch(url, { cache: "force-cache" }); }
      catch (e) { throw new Error("[step:fetchSaved] " + errorMessage(e, "读取已保存音频失败")); }
      if (!res.ok) throw new Error("[step:fetchSaved] HTTP " + res.status);
      var ab;
      try { ab = await res.arrayBuffer(); }
      catch (e) { throw new Error("[step:arrayBufferSaved] " + errorMessage(e, "读取已保存音频内容失败")); }
      var audioBuf;
      try { audioBuf = await ctx.decodeAudioData(ab.slice(0)); }
      catch (e) { throw new Error("[step:decodeSaved] " + errorMessage(e, "已保存音频解码失败")); }
      track.decodedAudioBuffer = audioBuf;
      track.decodedAudioBufferUrl = url;
      track.duration_s = audioBuf.duration || track.duration_s || 0;
      debugLog("📦 已解码保存音频: " + (url === track.offlineUrl ? "本机缓存" : "服务端缓存") + " duration=" + (audioBuf.duration || 0).toFixed(2) + "s", "#9f9");
      return audioBuf;
    }
    async function playSavedTrackViaDecodedBuffer(track, url, startSec, opts) {
      opts = opts || {};
      if (!track || !url) return false;
      stopWebAudioPlayback("replace");
      clearElementAudioSrc();
      var token = ++webAudioPlayToken;
      var playbackRate = clampNumber(cfg.speedFactor || 1.0, 1.0, 0.85, 1.25);
      setTrackPlaybackState(track, "loading");
      setPlayState("loading");
      setStatus(opts.noticeTitle || "读取已保存音频…");
      showTrackNotice(track, opts.noticeTitle || "读取已保存音频…", opts.noticeDetail || "准备播放已保存音频");
      try {
        var audioBuf = await decodedBufferForSavedTrack(track, url, opts.noticeDetail);
        if (token !== webAudioPlayToken) return false;
        var ctx = PRIMED_CTX;
        try { if (ctx.state === "suspended") await ctx.resume(); }
        catch (e) { throw new Error("[step:resume] " + errorMessage(e, "AudioContext resume 失败")); }
        if (!ctx || String(ctx.state || "running") !== "running") {
          throw (typeof audioContextBlockedError === "function" ? audioContextBlockedError("resume", ctx) : new Error("[step:resume] AudioContext state=" + String((ctx && ctx.state) || "unknown") + "，音频通道未放行"));
        }
        var source = ctx.createBufferSource();
        source.buffer = audioBuf;
        try { source.playbackRate.value = playbackRate; } catch (_) {}
        var gain = ctx.createGain ? ctx.createGain() : null;
        if (gain) {
          gain.gain.value = 1;
          source.connect(gain);
          gain.connect(ctx.destination);
        } else {
          source.connect(ctx.destination);
        }
        var offset = Math.max(0, Math.min(Number(startSec || 0) || 0, Math.max(0, audioBuf.duration - 0.05)));
        var startCtxTime = ctx.currentTime + 0.035;
        var stopped = false;
        webAudioController = {
          stop: function (reason) {
            stopped = true;
            try { source.stop(0); } catch (_) {}
            try { source.disconnect(); } catch (_) {}
            try { if (gain) gain.disconnect(); } catch (_) {}
            markWebAudioStopped(track);
            clearWebAudioProgressTimer();
            if (reason && reason !== "replace" && reason !== "switch" && reason !== "silent") {
              setPlayState("idle");
              setTrackPlaybackState(track, reason === "pause" ? "paused" : "idle");
            }
          },
          getTimeSec: function () {
            var pos = offset + Math.max(0, ((ctx.currentTime || 0) - startCtxTime) * playbackRate);
            return Math.min(audioBuf.duration || pos, pos);
          }
        };
        source.onended = function () {
          if (stopped || token !== webAudioPlayToken) return;
          markWebAudioStopped(track);
          webAudioController = null;
          clearWebAudioProgressTimer();
          stopSubtitle();
          setTrackPlaybackState(track, "ended");
          setPlayState("idle");
          setStatus("播放完成");
          if (track.cacheKey && track.cacheUrl) scheduleOfflineAudioSave(track, "ended cache", 800);
        };
        source.start(startCtxTime, offset);
        setTimeout(function () {
          if (stopped || token !== webAudioPlayToken) return;
          if (!ctx || String(ctx.state || "running") !== "running") {
            stopped = true;
            try { source.stop(0); } catch (_) {}
            try { source.disconnect(); } catch (_) {}
            try { if (gain) gain.disconnect(); } catch (_) {}
            try { if (typeof resetPrimedAudioContext === "function") resetPrimedAudioContext("saved scheduled not running"); } catch (_) {}
            markWebAudioStopped(track);
            webAudioController = null;
            clearWebAudioProgressTimer();
            setTrackPlaybackState(track, "paused");
            setPlayState("idle");
            setStatus("音频通道未放行，点播放继续");
            showTrackNotice(track, "音频通道未放行", "系统还没有允许 Web Audio 出声，点播放重试");
            debugLog("⚠️ 保存音频已排程但 AudioContext 未运行: " + String((ctx && ctx.state) || "unknown"), "#fc9");
            return;
          }
          track.pausedByHost = false;
          track.webAudioPlaying = true;
          setTrackPlaybackState(track, "playing");
          setPlayState("playing");
          setStatus("正在播放：" + trackPlaybackLabel(track));
          startWebAudioProgress(token, Date.now(), playbackRate, track, offset);
          startSubtitle(track, function () {
            if (webAudioController && typeof webAudioController.getTimeSec === "function") return webAudioController.getTimeSec();
            return offset;
          });
        }, Math.max(0, (startCtxTime - (ctx.currentTime || 0)) * 1000 + 45));
        return true;
      } catch (e) {
        if (token !== webAudioPlayToken) return false;
        markWebAudioStopped(track);
        webAudioController = null;
        clearWebAudioProgressTimer();
        setTrackPlaybackState(track, "error");
        setPlayState("idle");
        setStatus("播放失败");
        var friendly = friendlyPlaybackError(e);
        setError(friendly);
        showTrackNotice(track, "播放失败", friendly);
        debugLog("❌ 保存音频解码播放失败: " + errorMessage(e, "保存音频播放失败"), "#f99");
        return false;
      }
    }
    async function playSavedTrack(track, startSec, opts) {
      opts = opts || {};
      if (!track) return false;
      if (cfg.offlineAudioEnabled) await hydrateOfflineAudio(track, opts.label || "play saved");
      if (!(await verifySavedTrackAvailable(track, opts.label || "play saved"))) return false;
      var url = trackPlayableUrl(track);
      if (!url) return false;
      startSec = Math.max(0, Number(startSec || 0) || 0);
      if (cfg.offlineAudioEnabled && !track.offlineUrl && track.cacheUrl) {
        scheduleOfflineAudioSave(track, (opts.label || "play saved") + " offline copy", 2500);
      }
      if (shouldUseWebAudioForSavedTrack(track)) {
        return playSavedTrackViaDecodedBuffer(track, url, startSec, {
          noticeTitle: opts.noticeTitle || (startSec > 0 ? "从断点继续播放" : "读取已保存音频…"),
          noticeDetail: opts.noticeDetail || "手机端使用 Web Audio 播放已保存音频"
        });
      }
      return startElementAudioFrom(track, startSec);
    }
