// GPT-SoVITS Tavo runtime part: 32_audio_element_manager.js
// Role: 管理每个track的独立audio元素，防止多个audio打架
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.

  // 全局audio元素池管理
  var allAudioElements = []; // 所有创建的audio元素

  /**
   * 为track创建或获取audio元素
   */
  function getOrCreateAudioForTrack(track) {
    if (!track) return null;

    // 如果已经有audio元素，直接返回
    if (track.audioElement && track.audioElement.parentNode) {
      return track.audioElement;
    }

    // 创建新的audio元素
    var audio = document.createElement('audio');
    audio.setAttribute('preload', 'none');
    audio.setAttribute('data-track-id', track.cacheKey || '');

    // 隐藏audio元素（不需要显示在DOM中）
    audio.style.display = 'none';
    document.body.appendChild(audio);

    // 保存到track和全局池
    track.audioElement = audio;
    allAudioElements.push(audio);

    debugLog("🎵 创建audio元素: cacheKey=" + (track.cacheKey || 'no-key'), "#9f9");

    return audio;
  }

  /**
   * 暂停所有其他track的audio元素
   */
  function pauseOtherAudioElements(currentTrack) {
    allAudioElements.forEach(function(audio) {
      try {
        var trackId = audio.getAttribute('data-track-id');
        var isCurrent = currentTrack && currentTrack.audioElement === audio;
        if (!isCurrent && !audio.paused) {
          audio.pause();
          debugLog("⏸️ 暂停其他audio: trackId=" + trackId, "#fc9");
        }
      } catch (e) {
        debugLog("⚠️ 暂停audio失败: " + (e && e.message), "#fc9");
      }
    });
  }

  /**
   * 清理track的audio元素
   */
  function cleanupAudioForTrack(track) {
    if (!track || !track.audioElement) return;

    try {
      track.audioElement.pause();
      track.audioElement.src = '';
      if (track.audioElement.parentNode) {
        track.audioElement.parentNode.removeChild(track.audioElement);
      }

      // 从全局池移除
      var idx = allAudioElements.indexOf(track.audioElement);
      if (idx >= 0) {
        allAudioElements.splice(idx, 1);
      }

      debugLog("🗑️ 清理audio元素: cacheKey=" + (track.cacheKey || 'no-key'), "#999");

      track.audioElement = null;
    } catch (e) {
      debugLog("⚠️ 清理audio失败: " + (e && e.message), "#fc9");
    }
  }

  /**
   * 清理所有audio元素（用于重新加载时）
   */
  function cleanupAllAudioElements() {
    allAudioElements.forEach(function(audio) {
      try {
        audio.pause();
        audio.src = '';
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      } catch (e) {}
    });
    allAudioElements = [];
    debugLog("🗑️ 清理所有audio元素", "#999");
  }
