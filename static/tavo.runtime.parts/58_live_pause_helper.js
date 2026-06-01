// GPT-SoVITS Tavo runtime part: 58_live_pause_helper.js
// Role: live-track pause helper used by generate/playback controls.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    function pauseLiveTrack(track) {
      if (!track) return;
      track.pausedByUser = true;
      try {
        if (isFinite(Number(audio.currentTime))) track.lastElementSec = Math.max(0, elementPlaybackTimeSec(track));
      } catch (_) {}
      try { audio.pause(); } catch (_) {}
      stopWebAudioPlayback("pause");
      track.playSavedWhenReady = false;
      setPlayState("idle");
      setStatus("已暂停");
      showTrackNotice(track, "已暂停", track.cacheKey ? "不会自动恢复流式；保存完成后点播放会检查历史音频" : "已停止等待");
    }
