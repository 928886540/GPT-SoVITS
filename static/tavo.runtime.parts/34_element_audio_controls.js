// GPT-SoVITS Tavo runtime part: 34_element_audio_controls.js
// Role: element-audio playback labels, seek helpers, and audio element fallback controls.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    function playbackLabelForRole(role, track) {
      role = String(role || "").trim() || "多音色";
      var voice = voiceNameForRole(role, track);
      return displayRoleName(role) + (voice ? " / " + shortName(voice) : "");
    }
    function trackPlaybackLabel(track) {
      if (!track) return shortName(cfg.defaultVoice);
      if (track.mode === "ai8") {
        var role = lastSpeakerRole || ((track.segments && track.segments[0] && track.segments[0].role) || "");
        return role ? playbackLabelForRole(role, track) : "多音色";
      }
      return shortName((track && track.voice) || cfg.defaultVoice);
    }
    function setPlayingStatusForRole(role, track) {
      setStatus("正在播放：" + playbackLabelForRole(role, track || currentTrack()));
    }
    function setAudioPlaybackRate() {
      try { audio.playbackRate = clampNumber(cfg.speedFactor || 1.0, 1.0, 0.85, 1.25); } catch (_) {}
    }
    function markElementAudioTrack(track, sourceKind, liveOffsetSec) {
      try {
        if (!audio) return;
        if (track && track.cacheKey) audio.dataset.idxCacheKey = String(track.cacheKey);
        else delete audio.dataset.idxCacheKey;
        audio.dataset.idxSourceKind = sourceKind || "";
        if (sourceKind === "stream" && isFinite(Number(liveOffsetSec))) audio.dataset.idxLiveOffsetSec = String(Math.max(0, Number(liveOffsetSec) || 0));
        else delete audio.dataset.idxLiveOffsetSec;
      } catch (_) {}
    }
    function elementAudioBelongsToTrack(track) {
      if (!track || !audio) return false;
      try {
        if (track.cacheKey && audio.dataset.idxCacheKey === String(track.cacheKey)) return true;
      } catch (_) {}
      var src = "";
      try { src = audio.currentSrc || audio.src || ""; } catch (_) {}
      return !!(src && src === trackPlayableUrl(track));
    }
    function liveElementOffsetSec(track) {
      if (!track || !audio) return 0;
      try {
        if (audio.dataset.idxSourceKind === "stream" && audio.dataset.idxLiveOffsetSec != null) {
          return Math.max(0, Number(audio.dataset.idxLiveOffsetSec) || 0);
        }
      } catch (_) {}
      return Math.max(0, Number(track.liveElementOffsetSec || 0) || 0);
    }
    function elementPlaybackTimeSec(track) {
      var current = 0;
      try { current = Math.max(0, Number(audio.currentTime || 0) || 0); } catch (_) { current = 0; }
      return (isElementUsingTrackStream(track) ? liveElementOffsetSec(track) : 0) + current;
    }
    function trackResumeSec(track) {
      if (!track) return 0;
      var src = "";
      try { src = audio.currentSrc || audio.src || ""; } catch (_) {}
      var playable = trackPlayableUrl(track);
      if ((elementAudioBelongsToTrack(track) || (playable && src === playable)) && isFinite(Number(audio.currentTime))) return Math.max(0, elementPlaybackTimeSec(track));
      if (isFinite(Number(track.lastWebAudioSec))) return Math.max(0, Number(track.lastWebAudioSec) || 0);
      if (isFinite(Number(track.lastElementSec))) return Math.max(0, Number(track.lastElementSec) || 0);
      if (isFinite(Number(track.lastStalledSec))) return Math.max(0, Number(track.lastStalledSec) || 0);
      return 0;
    }
    function segmentStartSec(seg, sampleRate) {
      if (!seg) return NaN;
      if (isFinite(Number(seg.start_s))) return Math.max(0, Number(seg.start_s));
      if (isFinite(Number(seg.start_offset_s))) return Math.max(0, Number(seg.start_offset_s));
      sampleRate = Number(sampleRate || seg.sample_rate || 0);
      if (sampleRate > 0 && isFinite(Number(seg.start_offset_bytes))) {
        return Math.max(0, Number(seg.start_offset_bytes) / (sampleRate * 2));
      }
      return NaN;
    }
    function trackDurationHintSec(track) {
      if (!track) return 0;
      var d = Number(track.duration_s || (track.metrics && track.metrics.audio_duration_s));
      if (isFinite(d) && d > 0) return d;
      var sr = Number(track.sampleRate || track.sample_rate || 0);
      var maxEnd = 0;
      (track.segments || []).forEach(function (s) {
        var st = segmentStartSec(s, sr);
        var dur = Number(s.duration_s || 0);
        if (isFinite(st) && isFinite(dur) && dur > 0) maxEnd = Math.max(maxEnd, st + dur);
      });
      return maxEnd;
    }
    function seekToSeconds(pos, opts) {
      opts = opts || {};
      var track = currentTrack();
      pos = Math.max(0, Number(pos) || 0);
      var dur = Number(audio && audio.duration);
      var sourceKind = "";
      try { sourceKind = audio && audio.dataset ? String(audio.dataset.idxSourceKind || "") : ""; } catch (_) { sourceKind = ""; }
      if (audio && (audio.currentSrc || audio.src) && sourceKind !== "stream" && isFinite(dur) && dur > 0) {
        audio.currentTime = Math.max(0, Math.min(dur - 0.05, pos));
        return true;
      }
      if (track && isSavedTrack(track) && trackPlayableUrl(track)) {
        if (shouldUseWebAudioForSavedTrack(track)) {
          playSavedTrack(track, pos, { label: "seek saved", noticeTitle: "跳转播放", noticeDetail: "从 " + formatTime(pos) + " 继续" }).catch(function (e) {
            debugLog("❌ 保存音频跳转失败: " + errorMessage(e, "保存音频跳转失败"), "#f99");
          });
        } else {
          startElementAudioFrom(track, pos);
        }
        return true;
      }
      if (track && isLiveTrack(track)) {
        setStatus("流式播放中，暂不能跳转");
        showTrackNotice(track, "流式播放中", "歌词跳转需等完整音频保存后使用");
        debugLog("⚠️ live 流式音频未落盘，忽略 seek: " + (opts.noticeTitle || "seek") + " @" + formatTime(pos), "#fc9");
        return false;
      }
      return false;
    }
    function seekBySeconds(delta) {
      delta = Number(delta) || 0;
      var track = currentTrack();
      var dur = Number(audio && audio.duration);
      var maxDur = (isFinite(dur) && dur > 0) ? dur : trackDurationHintSec(track);
      var target = Math.max(0, trackResumeSec(track) + delta);
      if (maxDur > 0) target = Math.min(target, Math.max(0, maxDur - 0.05));
      return seekToSeconds(target, { noticeTitle: delta < 0 ? "后退 10 秒" : "快进 10 秒" });
    }
    function startElementAudioFrom(track, startSec) {
      if (!track || !trackPlayableUrl(track)) return false;
      stopWebAudioPlayback("switch");
      var url = trackPlayableUrl(track);
      var sourceKind = isSavedTrack(track) ? "saved" : (url === track.streamUrl ? "stream" : "audio");
      var liveOffsetSec = 0;
      if (!isSavedTrack(track) && isLiveTrack(track) && liveStreamUrlForTrack(track)) {
        liveOffsetSec = Math.max(0, Number(startSec || 0) || 0);
        url = liveStreamPlaybackUrlForTrack(track, liveOffsetSec);
        sourceKind = "stream";
        track.liveElementOffsetSec = liveOffsetSec;
      } else {
        track.liveElementOffsetSec = 0;
      }
      if ((audio.currentSrc || audio.src || "") !== url) {
        audio.src = url;
        try { audio.load(); } catch (_) {}
      }
      markElementAudioTrack(track, sourceKind, liveOffsetSec);
      setAudioPlaybackRate();
      if (seek) seek.disabled = false;
      if (startSec != null && isFinite(Number(startSec))) {
        var target = Math.max(0, Number(startSec));
        var seekApplied = false;
        var applySeek = function () {
          if (isFinite(audio.duration) && audio.duration > 0) target = Math.min(target, Math.max(0, audio.duration - 0.05));
          audio.currentTime = target;
          seekApplied = true;
        };
        if (sourceKind !== "stream") {
          try {
            if (audio.readyState > 0) applySeek();
          } catch (_) {}
          if (!seekApplied) {
            try { audio.addEventListener("loadedmetadata", function () { try { applySeek(); } catch (_) {} }, { once: true }); } catch (_) {}
          }
        } else {
          if (cur) cur.textContent = formatTime(liveOffsetSec);
          var hint = trackDurationHintSec(track);
          if (total) total.textContent = hint > 0 ? formatTime(hint) : "--:--";
        }
      }
      setStatus("正在加载音频…");
      showTrackNotice(track, "正在加载音频…", shouldUseElementForSavedTrack(track) ? "已加载音频，支持拖动" : "马上开始播放");
      setTrackPlaybackState(track, "loading");
      setPlayState("loading");
      audio.play().catch(function (err) { handleAudioPlayReject("element", err, "请点播放继续"); });
      return true;
    }
    function isUnsupportedPlayError(err) {
      var name = err && err.name ? String(err.name) : "";
      var msg = err && err.message ? String(err.message) : String(err || "");
      return name === "NotSupportedError" || /not supported/i.test(msg);
    }
    function recoverLiveTrackViaWebAudio(track, label, detail) {
      if (!track || !isLiveTrack(track) || !(track.cacheKey || liveStreamUrlForTrack(track))) return false;
      var resumeSec = trackResumeSec(track);
      track.elementAudioUnsupported = true;
      track.forceWebAudioLive = true;
      var liveUrl = liveStreamUrlForTrack(track);
      clearElementAudioSrc();
      debugLog("⚠️ " + (label || "audio 元素播放实时音频失败") + "，改用 Web Audio" + (detail || ""), "#fc9");
      if (liveUrl) {
        playLiveTrack(track, liveUrl, {
          noticeTitle: "切换播放通道…",
          noticeDetail: "当前 WebView 不支持 audio 元素播放，改用 Web Audio",
          waitDetail: "等待后端返回音频",
          startOffsetSec: resumeSec
        }).catch(function (e) {
          debugLog("❌ live audio fallback Web Audio 失败: " + errorMessage(e, "Web Audio fallback 失败"), "#f99");
        });
        return true;
      }
      if (track.cacheKey) {
        pollCacheUpgrade(track, "audio error live fallback");
        return true;
      }
      return false;
    }
    function handleAudioPlayReject(label, err, fallbackStatus) {
      if (err && err.name === "AbortError") return;
      if (isUnsupportedPlayError(err)) {
        debugLog("⚠️ " + label + " audio.play() 不支持: " + (err && err.message ? err.message : err), "#fc9");
        var active = currentTrack();
        if (active && isSavedTrack(active)) {
          active.elementAudioUnsupported = true;
          playSavedTrack(active, trackResumeSec(active), {
            label: "play unsupported fallback",
            noticeTitle: "切换播放通道…",
            noticeDetail: "当前 WebView 不支持 audio.play()，改用 Web Audio"
          }).catch(function (e) {
            debugLog("❌ audio.play fallback 失败: " + errorMessage(e, "audio.play fallback 失败"), "#f99");
          });
          return;
        }
        if (recoverLiveTrackViaWebAudio(active, label + " audio.play() 不支持", ": " + (err && err.message ? err.message : err))) return;
        setStatus(fallbackStatus || "当前 WebView 不支持 audio 直播，等待 Web Audio/请点播放");
        return;
      }
      debugLog("❌ " + label + " audio.play() reject: " + err, "#f99");
      setStatus(fallbackStatus || "请点播放继续");
    }
    function readableServerJobError(error) {
      var raw = String(error || "").trim();
      var clean = raw.replace(/\s+/g, " ").trim();
      if (!clean) return "服务端生成失败，请查看 adapter/官方 GPT-SoVITS 日志。";
      var m = clean.match(/official API HTTP\s*(\d{3})/i);
      if (m) {
        var seg = clean.match(/segment\s+\d+\s+role=[^:]+/i);
        return "官方 GPT-SoVITS 推理接口返回 " + m[1] + "，不是音频格式问题。请查官方 API 日志、模型服务和该段音色。" + (seg ? " 失败段：" + seg[0] : "");
      }
      if (/参考音频.*(?:3\s*[-~至到]\s*10|3~10)|3-10s|ref_audio/i.test(clean)) return clean;
      if (/LLM proxy request failed|auth_unavailable|no auth available|provider|model/i.test(clean)) {
        return "LLM 上游请求失败：" + clean;
      }
      return clean.length > 220 ? (clean.slice(0, 220) + "...") : clean;
    }
    function applyServerJobFailure(track, rawError, opts) {
      opts = opts || {};
      var readable = readableServerJobError(rawError);
      if (!track) return readable;
      track.error = readable;
      track.rawServerError = String(rawError || "");
      track.backgroundOnly = false;
      track.playSavedWhenReady = false;
      track.allowStreamPlay = false;
      track.pendingBlob = false;
      track.streaming = false;
      setTrackState(track, "failed");
      setTrackPlaybackState(track, "error");
      setTrackServerState(track, "failed");
      setTrackCacheState(track, "failed");
      setTrackStreamHealth(track, "interrupted");
      if (currentTrack() === track) {
        stopWebAudioPlayback("server-failed");
        clearElementAudioSrc();
        setPlayState("idle");
        setStatus("生成失败");
        showTrackNotice(track, opts.title || "服务端推理失败", readable);
      }
      if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
      return readable;
    }
    function friendlyPlaybackError(err) {
      var msg = errorMessage(err, "播放失败，请查看上一条请求日志和后端日志。");
      var active = currentTrack();
      if (active && trackState(active) === "failed" && active.error) return active.error;
      if (/\[step:fetchSaved\]\s+HTTP\s+(\d{3})/i.test(msg)) return "已保存音频读取失败：cache 音频请求返回 HTTP " + RegExp.$1 + "。请检查该 cache 是否仍存在。";
      if (/\[step:fetchSaved\]/i.test(msg)) return "已保存音频读取失败：Tavo WebView 没能读取 cache 音频，请看当前脚本同源地址和 adapter 日志。";
      if (/\[step:arrayBufferSaved\]/i.test(msg)) return "已保存音频内容读取失败：请求到了响应，但音频数据没有读完整。";
      if (/\[step:decodeSaved\]/i.test(msg)) return "已保存音频解码失败：cache 文件可能损坏或不是有效 WAV，请重新生成一次。";
      if (/\[step:resume\]/i.test(msg)) return "音频通道未放行：请再点一次播放，若仍失败说明 WebView/系统阻止了 AudioContext。";
      if (/noAudio|没有返回可播放音频/i.test(msg)) return "后端没有返回音频，请重新生成一次。";
      if (/fetch|network|Load failed|Failed to fetch/i.test(msg)) return "连接音频流失败。弱网下请稍后重试；如果持续失败，再检查服务地址和后端日志。";
      if (/wavHeader/i.test(msg)) return "服务端未返回音频流首包，正在确认服务端合成状态。";
      if (/decodeAudioData/i.test(msg)) return "已保存音频解码失败，可能是缓存文件损坏，请重新生成一次。";
      if (/WAV|data 段/i.test(msg)) return "服务端返回的音频内容不完整，请查看生成状态或重新生成。";
      if (/resume|AudioContext/i.test(msg)) return "浏览器没有放行音频播放，请点一次播放按钮重试。";
      return msg.replace(/\[step:[^\]]+\]\s*/g, "") || "播放失败，请查看上一条请求日志和后端日志。";
    }
    function setPlayState(state) { if (play) { play.dataset.state = state; play.innerHTML = state === "loading" ? loadingIcon() : playIcon(state); play.disabled = false; } if (cover) cover.dataset.playing = state === "playing" ? "1" : "0"; }
    function updateTrackButtons() {
      var track = currentTrack();
      if (prev) prev.disabled = currentTrackIndex <= 0;
      if (next) next.disabled = currentTrackIndex < 0 || currentTrackIndex >= generatedTracks.length - 1;
      var canSeekTrack = !!(track && (trackPlayableUrl(track) || track.webAudioPlaying || track.cacheKey));
      if (del) del.disabled = currentTrackIndex < 0 || !track;
      updateTrackCounter();
    }
    function clearWebAudioProgressTimer() {
      if (webAudioProgressTimer) {
        try { clearInterval(webAudioProgressTimer); } catch (_) {}
        webAudioProgressTimer = null;
      }
    }
    function clearElementAudioSrc() {
      try { audio.pause(); } catch (_) {}
      try { audio.removeAttribute("src"); audio.load(); } catch (_) {}
      markElementAudioTrack(null, "");
    }
