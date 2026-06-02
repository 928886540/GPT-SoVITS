// GPT-SoVITS Tavo runtime part: 38_saved_prompt_stream_helpers.js
// Role: saved-audio prompt switching and stream error helpers.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    async function askPlaySavedTrack(track) {
      if (!track || track.savePromptAsked || currentTrack() !== track || !isSavedTrack(track)) return;
      track.savePromptAsked = true;
      var choice = null;
      try {
        if (window.tavo && tavo.utils && typeof tavo.utils.select === "function") {
          choice = await tavo.utils.select([
            { value: "play", label: "直接播放", description: "从当前位置切到已保存音频，支持拖动进度条" },
            { value: "wait", label: "继续等待", description: "保持当前流式播放，不切换" }
          ], "音频已保存，是否直接播放？", "play");
        } else if (typeof window.confirm === "function") {
          choice = window.confirm("音频已保存，是否直接播放已保存音频？") ? "play" : "wait";
        }
      } catch (e) {
        debugLog("⚠️ 保存音频弹窗失败: " + errorMessage(e, "弹窗失败"), "#fc9");
      }
      if (choice !== "play" || currentTrack() !== track || !isSavedTrack(track)) return;
      var resumeSec = 0;
      try {
        if (webAudioController && typeof webAudioController.getTimeSec === "function") resumeSec = webAudioController.getTimeSec();
        else if (track.lastWebAudioSec != null) resumeSec = Number(track.lastWebAudioSec) || 0;
        else if (isElementUsingTrackStream(track) && isFinite(Number(audio.currentTime))) resumeSec = Number(audio.currentTime) || 0;
        else if (track.lastElementSec != null) resumeSec = Number(track.lastElementSec) || 0;
      } catch (_) { resumeSec = 0; }
      if (cfg.offlineAudioEnabled) await hydrateOfflineAudio(track, "switch saved");
      stopWebAudioPlayback("switch");
      playSavedTrack(track, resumeSec, { label: "switch saved", noticeTitle: "播放已保存音频", noticeDetail: "从当前进度继续" }).catch(function (e) {
        debugLog("❌ 切换保存音频失败: " + errorMessage(e, "切换保存音频失败"), "#f99");
      });
    }
    function isNetworkStreamError(err) {
      var msg = errorMessage(err, "");
      if (/\[step:fetch\]\s+HTTP\s+\d+/i.test(msg)) return false;
      return /\[step:(fetch|reader\.read|reader\.read\.loop)\]|Load failed|Failed to fetch|NetworkError|network/i.test(msg);
    }
    function markWebAudioStopped(track) {
      generatedTracks.forEach(function (t) { if (t) t.webAudioPlaying = false; });
      if (track) track.webAudioPlaying = false;
    }
