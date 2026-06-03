// GPT-SoVITS Tavo runtime part: 40_playback_cache.js // Source: static/tavo.runtime.js lines 2601-3600 before physical split. // Role: saved/live playback, cache hydration, seek and delete // This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script. 
    function stopWebAudioPlayback(reason) {
      webAudioPlayToken++;
      if (reason !== "replace" && reason !== "new-generation") {
        try { if (typeof stopAudioKeepalive === "function") stopAudioKeepalive(reason || "stopWebAudio"); } catch (_) {}
      }
      var activeTrack = currentTrack();
      if (activeTrack && webAudioController && typeof webAudioController.getTimeSec === "function") {
        try { activeTrack.lastWebAudioSec = Math.max(0, Number(webAudioController.getTimeSec()) || 0); } catch (_) {}
      }
      if (webAudioController && typeof webAudioController.stop === "function") {
        try { webAudioController.stop(reason || "停止播放"); } catch (_) {}
      }
      webAudioController = null;
      clearWebAudioProgressTimer();
      markWebAudioStopped(activeTrack);
      if (activeTrack && reason === "pause") setTrackPlaybackState(activeTrack, "paused");
      stopSubtitle();
      if (reason && reason !== "switch" && reason !== "replace" && reason !== "silent") {
        setPlayState("idle");
        setStatus(reason === "pause" ? "已暂停" : "播放已停止");
      }
    }
    function startWebAudioProgress(token, startedAt, playbackRate, track, fallbackOffsetSec) {
      fallbackOffsetSec = Math.max(0, Number(fallbackOffsetSec || 0) || 0);
      clearWebAudioProgressTimer();
      webAudioProgressTimer = setInterval(function () {
        if (token !== webAudioPlayToken) { clearWebAudioProgressTimer(); return; }
        var sec = 0;
        try {
          if (webAudioController && typeof webAudioController.getTimeSec === "function") sec = webAudioController.getTimeSec();
          else {
            var now = (typeof performance !== "undefined" ? performance.now() : Date.now());
            sec = Math.max(0, fallbackOffsetSec + ((now - startedAt) / 1000) * playbackRate);
          }
        } catch (_) { sec = 0; }
        if (cur) cur.textContent = formatTime(sec);
        var durHint = trackDurationHintSec(track);
        if (total) total.textContent = durHint > 0 ? formatTime(durHint) : "--:--";
        if (seek) {
          seekProgrammaticUpdate = true;
          seek.disabled = !(durHint > 0);
          seek.value = durHint > 0 ? String(Math.floor(Math.min(sec, durHint) / durHint * 1000)) : "0";
          setTimeout(function () { seekProgrammaticUpdate = false; }, 0);
        }
        try {
          if (navigator.mediaSession && navigator.mediaSession.setPositionState && durHint > 0) {
            navigator.mediaSession.setPositionState({
              duration: durHint,
              playbackRate: playbackRate || 1,
              position: Math.min(sec, durHint),
            });
          }
        } catch (_) {}
        if (track) track.lastWebAudioSec = sec;
      }, 250);
    }
    function requestLiveBackgroundCache(track, label) {
      if (!track || !track.cacheKey || track.backgroundCacheRequested) return;
      track.backgroundCacheRequested = true;
      try {
        var url = cleanBase(cfg.apiBase) + "/tts_dialogue_stream_job/" + encodeURIComponent(track.cacheKey) + "/background";
        adapterFetch(url, { method: "POST", keepalive: true }).then(function (res) {
          if (!res || !res.ok) {
            debugLog("⚠️ " + (label || "live background") + " 后台合成请求失败 HTTP " + (res && res.status), "#fc9");
            track.backgroundCacheRequested = false;
            return;
          }
          return res.json().then(function (j) {
            debugLog("📦 " + (label || "live background") + " 已请求后台合成: state=" + ((j && j.state) || "?") + " queue=" + ((j && j.queue_position) || 0), "#9ff");
          }).catch(function () {});
        }).catch(function (e) {
          track.backgroundCacheRequested = false;
          debugLog("⚠️ " + (label || "live background") + " 后台合成请求失败: " + errorMessage(e, "请求失败"), "#fc9");
        });
      } catch (_) {
        track.backgroundCacheRequested = false;
      }
    }
    function keepLiveTrackForCache(track, title, detail, label) {
      if (!track || track.deleted || isSavedTrack(track)) return;
      track.playSavedWhenReady = false;
      track.backgroundOnly = false;
      track.allowStreamPlay = false;
      if (track.cacheKey) {
        requestLiveBackgroundCache(track, label || "live background");
        try { pollCacheUpgrade(track, label || "live background"); } catch (_) {}
      }
      setTrackPlaybackState(track, "idle");
      setPlayState("idle");
      setStatus(title || "等待音频保存");
      showTrackNotice(track, title || "等待音频保存", detail || "不删除任务；保存完成后会成为历史音频");
      debugLog("🎧 保留 live 等待保存: " + (label || "live") + (track.cacheKey ? " cacheKey=" + track.cacheKey : ""), "#9ff");
    }
    async function playTrackViaWebAudio(track, url, opts) {
      opts = opts || {};
      if (!track || !url) return false;
      stopWebAudioPlayback("replace");
      var token = ++webAudioPlayToken;
      var playbackRate = clampNumber(cfg.speedFactor || 1.0, 1.0, 0.85, 1.25);
      var startOffsetSec = Math.max(0, Number(opts.startOffsetSec || 0) || 0);
      var startedAt = 0;
      var waitStartedAt = Date.now();
      var waitTimer = null;
      var firstAudioTimedOut = false;
      var streamTooSlowFallback = false;
      function stopWaitTimer() {
        if (waitTimer) { try { clearInterval(waitTimer); } catch (_) {} waitTimer = null; }
      }
      track.webAudioPlaying = false;
      setTrackStreamHealth(track, "ok");
      clearElementAudioSrc();
      if (seek) { seek.disabled = true; seek.value = "0"; }
      if (cur) cur.textContent = formatTime(startOffsetSec);
      if (total) total.textContent = "--:--";
      setError("");
      setTrackPlaybackState(track, "loading");
      setPlayState("loading");
      setStatus(opts.connectingStatus || "正在连接音频…");
      showTrackNotice(track, opts.noticeTitle || "正在连接音频…", opts.noticeDetail || "等待后端返回声音");
      waitTimer = setInterval(function () {
        if (token !== webAudioPlayToken) { stopWaitTimer(); return; }
        if (track.webAudioPlaying) return;
        var sec = Math.max(1, Math.floor((Date.now() - waitStartedAt) / 1000));
        if (sec >= 90 && !firstAudioTimedOut) {
          firstAudioTimedOut = true;
          setTrackStreamHealth(track, "stalled");
          setStatus("等待首段音频超过 90s…");
          showTrackNotice(track, "等待首段音频超过 90s…", "弱网或后端较慢，继续等待，不删除任务");
          debugLog("⚠️ 首段音频等待超过 90s，继续保留 live cacheKey=" + (track.cacheKey || ""), "#fc9");
        }
        setStatus("等待首段音频 " + sec + "s…");
        showTrackNotice(track, "等待首段音频 " + sec + "s…", opts.waitDetail || "弱网或后端合成较慢");
      }, 1000);
      try {
        await streamWavViaWebAudio(url, {
          playbackRate: playbackRate,
          onController: function (controller) {
            if (token === webAudioPlayToken) webAudioController = controller;
          },
          onStateChange: function (state) {
            if (token !== webAudioPlayToken) return;
            if (state === "connecting") {
              setTrackPlaybackState(track, "loading");
              setStatus("正在连接音频…");
              showTrackNotice(track, "正在连接音频…", "弱网下可能需要多等几秒");
            } else if (state === "connected" || state === "waiting_pcm") {
              setTrackPlaybackState(track, "streaming");
              setStatus("等待首段音频…");
              showTrackNotice(track, "等待首段音频…", opts.waitDetail || "后端正在合成第一段");
            } else if (state === "first_pcm") {
              setTrackPlaybackState(track, "buffering");
              setStatus("收到音频，正在缓冲…");
              showTrackNotice(track, "收到音频", "缓冲一小段后起播");
            } else if (state === "scheduled") {
              setTrackPlaybackState(track, "buffering");
              setStatus("音频已排队，准备起播…");
              showTrackNotice(track, "音频已排队", "即将开始出声");
            } else if (state === "audio_suspended" || state === "audio_interrupted") {
              try {
                if (webAudioController && typeof webAudioController.getTimeSec === "function") {
                  track.lastWebAudioSec = Math.max(0, Number(webAudioController.getTimeSec()) || 0);
                } else {
                  track.lastWebAudioSec = trackResumeSec(track);
                }
              } catch (_) {
                track.lastWebAudioSec = trackResumeSec(track);
              }
              setTrackStreamHealth(track, state === "audio_interrupted" ? "interrupted" : "stalled");
              setTrackPlaybackState(track, "buffering");
              setPlayState("loading");
              var hostAudioTitle = state === "audio_interrupted" ? "宿主音频通道中断，等待恢复…" : "音频通道暂不可用，等待恢复…";
              setStatus(hostAudioTitle);
              showTrackNotice(track, hostAudioTitle, "不暂停、不删除 live；音频通道恢复后继续起播，未恢复时再等待保存");
              debugLog("⚠️ " + hostAudioTitle + " cacheKey=" + (track.cacheKey || ""), "#fc9");
            } else if (state === "audio_resumed") {
              setTrackPlaybackState(track, "buffering");
              setPlayState("loading");
              setStatus("音频通道已恢复，继续缓冲…");
              showTrackNotice(track, "音频通道已恢复", "继续接收并排队播放");
            } else if (state === "playing") {
              stopWaitTimer();
              try { if (typeof stopAudioKeepalive === "function") stopAudioKeepalive("live playing"); } catch (_) {}
              track.pausedByHost = false;
              track.streamPlaybackFinished = false;
              track.webAudioPlaying = true;
              setTrackPlaybackState(track, "playing");
              setPlayState("playing");
              setStatus("正在播放：" + trackPlaybackLabel(track));
              setError("");
              debugLog("▶️ Web Audio 播放时钟已启动", "#9f9");
              startedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
              startWebAudioProgress(token, startedAt, playbackRate, track, startOffsetSec);
              startSubtitle(track, function () {
                if (webAudioController && typeof webAudioController.getTimeSec === "function") return webAudioController.getTimeSec();
                return startOffsetSec + ((((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) / 1000) * playbackRate);
              });
            } else if (state === "buffering") {
              track.savePromptWanted = true;
              track.stalledCount = Number(track.stalledCount || 0) + 1;
              track.lastStalledAt = Date.now();
              track.lastStalledSec = trackResumeSec(track);
              setTrackStreamHealth(track, "stalled");
              setTrackPlaybackState(track, "buffering");
              setPlayState("loading");
              setStatus("网络缓冲中…");
              showTrackNotice(track, "网络缓冲中…", "歌词会停在当前播放位置");
              debugLog("⚠️ Web Audio buffering count=" + track.stalledCount, "#fc9");
              if (track.cacheKey && track.stalledCount >= 4 && !streamTooSlowFallback) {
                streamTooSlowFallback = true;
                track.playSavedWhenReady = false;
                setTrackStreamHealth(track, "interrupted");
                keepLiveTrackForCache(track, "实时播放缓冲，后台继续保存", "不删除任务；保存完成后可从历史音频播放", "stream too slow");
              }
            } else if (state === "resumed") {
              track.pausedByHost = false;
              setTrackPlaybackState(track, "playing");
              setPlayState("playing");
              setStatus("正在播放：" + trackPlaybackLabel(track));
            } else if (state === "interrupted") {
              stopWaitTimer();
              setTrackStreamHealth(track, "interrupted");
              markWebAudioStopped(track);
              webAudioController = null;
              clearWebAudioProgressTimer();
              stopSubtitle();
              keepLiveTrackForCache(track, "流式连接中断，等待保存", "不删除任务；如果后端完成，会自动成为历史音频", "stream interrupted");
            } else if (state === "stopped") {
              stopWaitTimer();
              markWebAudioStopped(track);
              setTrackPlaybackState(track, "paused");
              clearWebAudioProgressTimer();
            } else if (state === "ended") {
              stopWaitTimer();
              markWebAudioStopped(track);
              webAudioController = null;
              clearWebAudioProgressTimer();
              track.streamPlaybackFinished = true;
              setTrackPlaybackState(track, "ended");
              setPlayState("idle");
              stopSubtitle();
              if ((track.streamInterrupted || track.streamHealth === "interrupted") && !isSavedTrack(track)) {
                setStatus("网络中断，等待音频保存…");
                showTrackNotice(track, "网络中断，等待音频保存…", "保存完成后会询问是否直接播放");
              } else {
                var saved = shouldUseElementForSavedTrack(track);
                setStatus(saved ? "播放完成，音频已保存" : "播放完成，等待音频保存…");
                showTrackNotice(track, "播放完成", saved ? "点播放可重播" : "正在后台保存");
              }
            }
          },
          onError: function (e) { debugLog("❌ Web Audio 错误: " + errorMessage(e, "Web Audio 错误"), "#f99"); },
          debug: function (text) { debugLog("[wa] " + text, "#9ff"); },
          startOffsetSec: startOffsetSec
        });
        return true;
      } catch (e) {
        stopWaitTimer();
        if (token !== webAudioPlayToken) return false;
        var msg = errorMessage(e, "Web Audio 播放失败，但浏览器没有给出具体原因。");
        markWebAudioStopped(track);
        webAudioController = null;
        clearWebAudioProgressTimer();
        stopSubtitle();
        if (streamTooSlowFallback) {
          setTrackStreamHealth(track, "stalled");
          keepLiveTrackForCache(track, "实时播放缓冲，后台继续保存", "不删除任务；保存完成后可从历史音频播放", "stream too slow");
          return false;
        }
        if (firstAudioTimedOut) {
          setTrackStreamHealth(track, "stalled");
          keepLiveTrackForCache(track, "首段音频等待较久", "不删除任务；继续等待保存结果", "first audio slow");
          return false;
        }
        if ((e && e.name === "AbortError") || /播放已停止|停止播放/i.test(msg)) {
          setTrackPlaybackState(track, "idle");
          setPlayState("idle");
          return false;
        }
        if (isNetworkStreamError(e) && track.cacheKey) {
          setTrackStreamHealth(track, "interrupted");
          keepLiveTrackForCache(track, "流式连接中断，等待保存", "不删除任务；如果后端完成，会自动成为历史音频", "network stream error");
          debugLog("⚠️ Web Audio 连接中断，保留 live 等待保存: " + msg, "#fc9");
          return false;
        }
        if (track.cacheKey && /AudioContext|resume|schedulePcm|音频通道/i.test(msg)) {
          setTrackStreamHealth(track, /interrupted|中断/i.test(msg) ? "interrupted" : "stalled");
          keepLiveTrackForCache(track, "宿主音频通道未恢复，等待保存", "不暂停、不删除任务；保存完成后会成为历史音频", "audio context interrupted");
          debugLog("⚠️ Web Audio 宿主音频通道未恢复，保留 live 等待保存: " + msg, "#fc9");
          return false;
        }
        var friendly = friendlyPlaybackError(e);
        setTrackPlaybackState(track, "error");
        setPlayState("idle");
        setStatus("播放失败");
        setError(friendly);
        showTrackNotice(track, "播放失败", friendly);
        debugLog("❌ Web Audio 流式异常: " + msg, "#f99");
        return false;
      }
    }
    function playLiveTrack(track, url, opts) {
      opts = opts || {};
      if (!track || !url) return Promise.resolve(false);
      if (shouldUseWebAudioForLiveTrack(track)) return playTrackViaWebAudio(track, url, opts);
      var startOffsetSec = Math.max(0, Number(opts.startOffsetSec || 0) || 0);
      stopWebAudioPlayback("replace");
      track.streamUrl = liveStreamUrlForTrack(track) || url;
      track.url = track.streamUrl;
      track.streaming = true;
      track.allowStreamPlay = false;
      setTrackStreamHealth(track, "ok");
      setTrackPlaybackState(track, "loading");
      setPlayState("loading");
      setStatus(opts.noticeTitle || (startOffsetSec > 0 ? "从断点继续播放" : "连接流式音频"));
      showTrackNotice(track, opts.noticeTitle || "连接流式音频", opts.noticeDetail || "使用系统音频通道播放直播流");
      debugLog("▶️ live track 使用 audio 元素流式 start_s=" + startOffsetSec.toFixed(3), "#ffd479");
      return Promise.resolve(startElementAudioFrom(track, startOffsetSec));
    }
