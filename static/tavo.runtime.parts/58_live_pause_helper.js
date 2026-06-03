// GPT-SoVITS Tavo runtime part: 58_live_pause_helper.js
// Role: live-track pause helper used by generate/playback controls.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    function pauseLiveTrack(track) {
      if (!track) return;
      if (isCancelableLiveTrack(track)) {
        setStatus("正在中止流式…");
        showTrackNotice(track, "正在中止流式…", "未完成的流式任务会被删除，完成后请重新生成");
        cancelLiveTrack(track, "user pause").then(function () {
          if (!generatedTracks.length) showEmptyAfterLiveCancel("user pause");
          else selectTrack(Math.max(0, Math.min(currentTrackIndex, generatedTracks.length - 1)), false, { metadataOnly: true, reason: "live-cancel" }).catch(function () {});
        }).catch(function (e) { setError(errorMessage(e, "流式中止失败")); });
        return;
      }
      track.pausedByUser = true;
      try {
        if (isFinite(Number(audio.currentTime))) track.lastElementSec = Math.max(0, elementPlaybackTimeSec(track));
      } catch (_) {}
      try { audio.pause(); } catch (_) {}
      stopWebAudioPlayback("pause");
      track.playSavedWhenReady = false;
      setPlayState("idle");
      setStatus("已暂停");
      showTrackNotice(track, "已暂停", track.cacheKey ? "后台仍会继续保存；点播放再决定续播或读取历史音频" : "已停止等待");
    }
