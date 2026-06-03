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
        if (sec >= 90) {
          firstAudioTimedOut = true;
          setTrackStreamHealth(track, "interrupted");
          setTrackPlaybackState(track, "error");
          setPlayState("idle");
          setStatus("首段音频超时");
          setError("90 秒内没有收到可播放音频，已中止并删除这次流式任务。请点 + 重新生成。");
          showTrackNotice(track, "首段音频超时", "已中止并删除这次未完成流式任务");
          if (webAudioController && typeof webAudioController.stop === "function") {
            try { webAudioController.stop("first audio timeout"); } catch (_) {}
          }
          try { cancelLiveTrack(track, "first audio timeout").catch(function () {}); } catch (_) {}
          stopWaitTimer();
          return;
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
            } else if (state === "audio_suspended") {
              try {
                if (webAudioController && typeof webAudioController.getTimeSec === "function") {
                  track.lastWebAudioSec = Math.max(0, Number(webAudioController.getTimeSec()) || 0);
                } else {
                  track.lastWebAudioSec = trackResumeSec(track);
                }
              } catch (_) {
                track.lastWebAudioSec = trackResumeSec(track);
              }
              try {
                if (webAudioController && typeof webAudioController.stop === "function") webAudioController.stop("audio suspended");
              } catch (_) {}
              webAudioController = null;
              markWebAudioStopped(track);
              clearWebAudioProgressTimer();
              try { if (typeof resetPrimedAudioContext === "function") resetPrimedAudioContext("audio_suspended"); } catch (_) {}
              setTrackStreamHealth(track, "interrupted");
              setTrackPlaybackState(track, "error");
              setPlayState("idle");
              setStatus("音频通道未放行，已中止流式");
              setError("音频通道未放行，本次未完成流式已中止。请点 + 重新生成。");
              showTrackNotice(track, "音频通道未放行", "已中止并删除这次未完成流式任务");
              try { cancelLiveTrack(track, "audio_suspended").catch(function () {}); } catch (_) {}
            } else if (state === "playing") {
              stopWaitTimer();
              try { if (typeof stopAudioKeepalive === "function") stopAudioKeepalive("live playing"); } catch (_) {}
              track.pausedByHost = false;
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
                setStatus("实时生成跟不上，已中止流式");
                showTrackNotice(track, "实时生成跟不上", "已中止并删除这次未完成流式任务");
                debugLog("⚠️ Web Audio 连续缓冲，删除未完成 live cacheKey=" + track.cacheKey, "#fc9");
                if (webAudioController && typeof webAudioController.stop === "function") {
                  try { webAudioController.stop("stream too slow"); } catch (_) {}
                }
                try { cancelLiveTrack(track, "stream too slow").catch(function () {}); } catch (_) {}
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
              setTrackPlaybackState(track, "error");
              setPlayState("idle");
              setStatus("流式中断，已删除");
              showTrackNotice(track, "流式中断", "已中止并删除这次未完成流式任务");
              try { cancelLiveTrack(track, "stream interrupted").catch(function () {}); } catch (_) {}
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
          setTrackPlaybackState(track, "error");
          setPlayState("idle");
          setStatus("实时生成跟不上，已中止流式");
          return false;
        }
        if (firstAudioTimedOut) {
          setTrackStreamHealth(track, "interrupted");
          setTrackPlaybackState(track, "error");
          setPlayState("idle");
          setStatus("首段音频超时");
          return false;
        }
        if ((e && e.name === "AbortError") || /播放已停止|停止播放/i.test(msg)) {
          setTrackPlaybackState(track, "idle");
          setPlayState("idle");
          return false;
        }
        if (isNetworkStreamError(e) && track.cacheKey) {
          setTrackStreamHealth(track, "interrupted");
          setTrackPlaybackState(track, "error");
          setPlayState("idle");
          setStatus("流式中断，已删除");
          setError("网络中断，本次未完成流式已中止并删除。请点 + 重新生成。");
          showTrackNotice(track, "流式中断", "已中止并删除这次未完成流式任务");
          try { await cancelLiveTrack(track, "network stream error"); } catch (_) {}
          debugLog("⚠️ Web Audio 连接中断，删除未完成流式: " + msg, "#fc9");
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
