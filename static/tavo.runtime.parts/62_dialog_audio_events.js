// GPT-SoVITS Tavo runtime part: 62_dialog_audio_events.js
// Role: settings dialog layer controls and player/audio event bindings.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    function openDialog(d) {
      if (!d) return;
      // 通用 WebView 路径:不用 showModal()/top-layer，避免 Android/iOS WebView 在
      // dialog 事件、遮罩和穿透上的差异。只把它当 fixed layer 显示。
      try {
        d.removeAttribute('aria-hidden');
        d.setAttribute('data-open', '1');
        d.setAttribute('open', '');
        d.open = true;
      } catch (_) {}
    }
    function closeDialog(d) {
      if (!d) return;
      try {
        d.setAttribute('aria-hidden', 'true');
        d.removeAttribute('data-open');
        d.removeAttribute('open');
        d.open = false;
      } catch (_) {}
    }
    function keepLayerEventInside(e) {
      if (!e) return;
      try { e.stopPropagation(); } catch (_) {}
    }
    function installLayerEventGuard() {
      if (root.__idxLayerDocumentGuardInstalled) return;
      root.__idxLayerDocumentGuardInstalled = true;
      // iOS Tavo WebView 会在 dialog/body 重挂载、视觉视口偏移或 retargeting 时，
      // 把面板内部点击误判成外部点击。设置页不再支持“点外部关闭”，只允许
      // 明确点 × 或保存关闭；冒泡阶段拦截，避免挡掉按钮/输入框自己的事件。
      try {
        ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(function (type) {
          if (panel) panel.addEventListener(type, keepLayerEventInside, false);
        });
      } catch (_) {}
    }
    installLayerEventGuard();
    on(gear, 'click', async function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (isDialogOpen(panel)) closeDialog(panel);
      else {
        await refreshCharacterConfig({ forceSync: true });
        openDialog(panel);
      }
    });
    on(close, 'click', function () { closeDialog(panel); });
    // 移动 webview 的 audio.play() 必须在用户手势的同步调用栈里执行。generate(false)
    // 里有一串 await（refreshConfig/saveConfig/ensureTracksLoaded/prepareOffline）会把
    // 手势耗掉，导致已落盘音频暂停后再点播放被 NotAllowedError 拒绝、看起来“卡死没法播”。
    // 这里在手势内同步处理“元素音频已就绪”的续播/暂停，命中即不进 await 链。
    function tryResumeOrPauseInGesture() {
      try {
        var t = currentTrack();
        if (t && t.webAudioPlaying) {
          t.pausedByUser = true;
          try {
            if (webAudioController && typeof webAudioController.getTimeSec === "function") {
              t.lastWebAudioSec = Math.max(0, Number(webAudioController.getTimeSec()) || 0);
            }
          } catch (_) {}
          stopWebAudioPlayback("pause");
          setStatus("已暂停");
          showTrackNotice(t, "已暂停", "点播放从当前位置继续");
          return true;
        }
        if (!t || !elementAudioBelongsToTrack(t)) return false;
        if (!(audio.currentSrc || audio.src) || audio.ended) return false;
        if (audio.paused) {
          setAudioPlaybackRate();
          var p = audio.play();
          if (p && typeof p.then === "function") p.catch(function (e) { handleAudioPlayReject("element", e, "请点播放继续"); });
        } else {
          audio.pause();
        }
        return true;
      } catch (_) { return false; }
    }
    on(play, 'pointerdown', function () { primeAudioContext(); });
    on(add, 'pointerdown', function () { primeAudioContext(); });
    on(play, 'touchstart', function () { primeAudioContext(); });
    on(add, 'touchstart', function () { primeAudioContext(); });
    on(play, 'click', function () { primeAudioContext(); if (tryResumeOrPauseInGesture()) return; generate(false).catch(function (e) { setError(errorMessage(e, "播放失败")); }); });
    on(add, 'click', function () { primeAudioContext(); generate(true).catch(function (e) { setError(errorMessage(e, "生成失败")); }); });
    on(prev, 'click', function () {
      ensureTracksLoaded().then(function () { return selectTrack(currentTrackIndex - 1, true); }).catch(function (e) { setError(errorMessage(e, "上一条历史音频读取失败")); });
    });
    on(next, 'click', function () {
      ensureTracksLoaded().then(function () { return selectTrack(currentTrackIndex + 1, true); }).catch(function (e) { setError(errorMessage(e, "下一条历史音频读取失败")); });
    });
    on(del, 'click', function () { clearCurrentTrack().catch(function (e) { setError(errorMessage(e, "删除历史音频失败")); }); });
    on(first(panel, '[data-role="save"]'), 'click', async function () { readFields(); await saveConfig(cfg, characterId); syncUI(); closeDialog(panel); setStatus("设置已保存"); });
    // IME 组词期间不覆盖输入值（搜狗/微软拼音等）。事件委托到 panel 上，覆盖所有 data-field 输入。
    try {
      panel.addEventListener('compositionstart', function (e) {
        if (e.target && e.target.dataset && e.target.dataset.field) e.target.__sovitsComposing = true;
      }, true);
      panel.addEventListener('compositionend', function (e) {
        if (e.target && e.target.dataset && e.target.dataset.field) e.target.__sovitsComposing = false;
      }, true);
    } catch (_) {}
    on(first(panel, '[data-role="reload"]'), 'click', function () {
      voicesLoaded = false;
      ensureVoicesLoaded().catch(function (e) { setStatus("音色列表读取失败"); setError(errorMessage(e, "音色列表读取失败")); });
    });
    $all(panel, '.idx-mode').forEach(function (b) { b.addEventListener('click', async function () { readFields(); cfg.mode = b.dataset.mode; syncUI(); await saveConfig(cfg, characterId); }); });
    on(audio, 'play', function () {
      var t = currentTrack();
      if (t) setTrackPlaybackState(t, "playing");
      setPlayState("playing"); setStatus("正在播放：" + trackPlaybackLabel(t));
      // 系统媒体面板基础信息(后台/锁屏可见,可控制播放/前后 10 秒)
      try { updateMediaSession(lastSpeakerRole, ""); } catch (_) {}
      // 桌面 / <audio> 路径的字幕：当前 track 是 ai8 且有 segments 时启动
      if (t && t.mode === "ai8") {
        if (t.segments && t.segments.length) {
          startSubtitle(t, function () { return elementPlaybackTimeSec(t); });
        } else if (t.cacheKey && !t.fetchingSegments) {
          // 历史卡片没存 segments → 后台拉 job_status 补回来
          t.fetchingSegments = true;
          debugLog("📥 历史卡无 segments,后台拉 job_status…", "#9ff");
          fetch(cleanBase(cfg.apiBase) + "/tts_dialogue_job_status/" + encodeURIComponent(t.cacheKey))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
              if (j && Array.isArray(j.segments_meta) && j.segments_meta.length) {
                t.segments = j.segments_meta.map(function (s) {
                  return { role: s.role || "", text: s.text || "", style: s.style || "neutral", style_alpha: s.style_alpha, start_s: s.start_s, start_offset_bytes: s.start_offset_bytes, duration_s: s.duration_s };
                });
                if (j.sample_rate) t.sampleRate = j.sample_rate;
                if (j.duration_s) t.duration_s = j.duration_s;
                if (j.metrics) t.metrics = j.metrics;
                debugLog("✅ 补回 " + t.segments.length + " 段 segments,字幕启动", "#9f9");
                // 现在启动字幕
                if (currentTrackIndex >= 0 && generatedTracks[currentTrackIndex] === t) {
                  startSubtitle(t, function () { return elementPlaybackTimeSec(t); });
                }
                if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
              } else {
                debugLog("⚠️ job_status 没返回 segments_meta(可能服务端没存这条历史)", "#fc9");
              }
            })
            .catch(function (e) { debugLog("❌ 拉 segments_meta 失败: " + errorMessage(e, "请求失败"), "#f99"); })
            .finally(function () { t.fetchingSegments = false; });
        }
      }
    });
    on(audio, 'waiting', function () {
      var t = currentTrack();
      var label = waitingLabelForTrack(t);
      if (t) setTrackPlaybackState(t, "buffering");
      setPlayState("loading");
      setStatus(label);
      if (t && !hasActiveSubtitleRows(t)) showTrackNotice(t, label, "歌词会停在当前播放位置");
    });
    on(audio, 'canplay', function () {
      setError("");
      if (!audio.paused) {
        var t = currentTrack();
        if (t) setTrackPlaybackState(t, "playing");
        setPlayState("playing");
        // 多音色模式下当前播放的音色不固定,不要写 cfg.defaultVoice
        setStatus("正在播放：" + trackPlaybackLabel(t));
      }
    });
    on(audio, 'playing', function () { var t = currentTrack(); if (t) setTrackPlaybackState(t, "playing"); setError(""); setPlayState("playing"); setStatus("正在播放：" + trackPlaybackLabel(t)); });
    on(audio, 'pause', function () { var t = currentTrack(); if (t && !audio.ended) setTrackPlaybackState(t, "paused"); setPlayState("idle"); if (audio.currentTime > 0 && !audio.ended) setStatus("已暂停"); stopSubtitle(); });
    on(audio, 'ended', function () {
      var t = currentTrack();
      if (t && t.mode === "single" && t.cacheKey && t.cacheUrl) {
        setTrackState(t, "saved");
        attachCacheAudio(t, { deferElement: true });
        if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
      }
      if (t && t.cacheKey && t.cacheUrl) scheduleOfflineAudioSave(t, "ended offline", 800);
      if (t) setTrackPlaybackState(t, "ended");
      setPlayState("idle");
      setStatus("播放完成");
      stopSubtitle();
    });
    on(audio, 'error', function () {
      var active = currentTrack();
      if (active && (active.webAudioPlaying || shouldUseWebAudioForLiveTrack(active))) {
        debugLog("⚠️ 忽略 audio 元素错误：当前手机链路使用 Web Audio，src=" + (audio.currentSrc || audio.src || ""), "#fc9");
        setError("");
        return;
      }
      var detail = "";
      try {
        if (audio.error) detail = " code=" + audio.error.code + (audio.error.message ? " message=" + audio.error.message : "");
      } catch (_) {}
      if (active && isSavedTrack(active)) {
        active.elementAudioUnsupported = true;
        var savedResumeSec = trackResumeSec(active);
        debugLog("⚠️ audio 元素播放保存音频失败，改用 Web Audio" + detail, "#fc9");
        clearElementAudioSrc();
        playSavedTrack(active, savedResumeSec, {
          label: "audio error fallback",
          noticeTitle: "切换播放通道…",
          noticeDetail: "当前 WebView 不支持 audio 元素播放，改用 Web Audio"
        }).catch(function (e) {
          debugLog("❌ audio fallback Web Audio 失败: " + errorMessage(e, "Web Audio fallback 失败"), "#f99");
        });
        return;
      }
      if (recoverLiveTrackViaWebAudio(active, "audio 元素播放实时音频失败", detail)) return;
      if (active) setTrackPlaybackState(active, "error");
      setPlayState("idle");
      setStatus("播放失败");
      setError("音频加载失败。" + detail + " 请检查服务地址、音色和后端日志。");
      debugLog("❌ audio error" + detail + " src=" + (audio.currentSrc || audio.src || ""), "#f99");
      stopSubtitle();
    });
    on(audio, 'loadedmetadata', function () {
      setError("");
      setAudioPlaybackRate();
      if (seek) seek.disabled = false;
      var t = currentTrack();
      var hint = trackDurationHintSec(t);
      var dur = Number(audio.duration);
      if (total) total.textContent = (isFinite(dur) && dur > 0) ? formatTime(dur) : (hint > 0 ? formatTime(hint) : "--:--");
      debugLog("📐 audio metadata loaded: duration=" + (isFinite(dur) ? dur.toFixed(2) : String(audio.duration)) + "s seekable=" + (audio.seekable.length > 0 ? audio.seekable.end(0).toFixed(2) : "0"), "#9ff");
    });
    on(audio, 'seeking', function () { debugLog("⏩ seeking → " + audio.currentTime.toFixed(2), "#9ff"); });
    on(audio, 'seeked',  function () { debugLog("✅ seeked  → " + audio.currentTime.toFixed(2), "#9ff"); });
    on(audio, 'stalled', function () {
      var t = currentTrack();
      if (t) {
        t.stalledCount = Number(t.stalledCount || 0) + 1;
        setTrackStreamHealth(t, "stalled");
        t.lastStalledAt = Date.now();
        t.lastStalledSec = elementPlaybackTimeSec(t);
      }
      debugLog("⚠️ stalled @ " + audio.currentTime.toFixed(2) + (t ? " count=" + t.stalledCount : ""), "#fc9");
    });
    on(audio, 'timeupdate', function () {
      var activeTrack = currentTrack();
      var pos = elementPlaybackTimeSec(activeTrack);
      if (activeTrack) activeTrack.lastElementSec = pos;
      var dur = Number(audio.duration);
      var hasDur = isFinite(dur) && dur > 0;
      var hint = trackDurationHintSec(activeTrack);
      var progressDur = hasDur ? dur : hint;
      if (cur) cur.textContent = formatTime(pos);
      if (total) total.textContent = progressDur > 0 ? formatTime(progressDur) : "--:--";
      if (seek) {
        seekProgrammaticUpdate = true;
        seek.disabled = !(progressDur > 0);
        seek.value = progressDur > 0 ? String(Math.floor(Math.min(pos, progressDur) / progressDur * 1000)) : "0";
        setTimeout(function () { seekProgrammaticUpdate = false; }, 0);
      }
    });
    on(seek, 'input', function () {
      if (seekProgrammaticUpdate) return;
      var dur = Number(audio && audio.duration);
      if (audio && isFinite(dur) && dur > 0) audio.currentTime = Number(seek.value || 0) / 1000 * dur;
      else {
        var t = currentTrack();
        var hint = trackDurationHintSec(t);
        if (hint > 0 && cur) cur.textContent = formatTime(Number(seek.value || 0) / 1000 * hint);
      }
    });
    on(seek, 'change', function () {
      if (seekProgrammaticUpdate) return;
      var dur = Number(audio && audio.duration);
      if (audio && isFinite(dur) && dur > 0) return;
      var t = currentTrack();
      var hint = trackDurationHintSec(t);
      if (hint > 0) seekToSeconds(Number(seek.value || 0) / 1000 * hint, { noticeTitle: "拖动进度" });
    });

    updateTrackButtons();
    syncUI();
    knownHistoryCount = messageId ? localHistoryCountForMessage(messageId) : 0;
    setStatus(noTrackStatusText());
    showNoTrackNotice();
    initializeHistoryCount().catch(function () {});
  }
