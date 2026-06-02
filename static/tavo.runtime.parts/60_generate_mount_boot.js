// GPT-SoVITS Tavo runtime part: 60_generate_mount_boot.js // Source: static/tavo.runtime.js lines 4551-5158 before physical split. // Role: generate flow, dialog events, mount/bootstrap // This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script. 
    async function generate(force) {
      closeVoicePickerForPlayback();
      await refreshCharacterConfig({ skipIfEditing: true });
      readFields(); await saveConfig(cfg, characterId); setError("");
      if (!messageText) { setError("当前消息没有可朗读正文。"); return; }
      if (force) {
        try { audio.pause(); } catch (_) {}
        stopWebAudioPlayback("new-generation");
      }
      try {
        await ensureTracksLoaded(force ? { selectRestored: false, statusOnEmpty: false } : null);
      } catch (e) {
        setError((force ? "历史记录读取失败: " : "历史音频读取失败: ") + errorMessage(e, "读取历史记录失败"));
        return;
      }
      // 已有卡片时，播放按钮只做"播放/暂停/选当前卡片"，不生成新音频。
      // 新建必须点 + 号（force=true 才走下面的 generate 流程）。
      if (!force && generatedTracks.length > 0) {
        if (currentTrackIndex < 0) currentTrackIndex = generatedTracks.length - 1;
        var existingTrack = currentTrack();
        if (!existingTrack) return;
        if (existingTrack.webAudioPlaying || isElementPlayingTrackStream(existingTrack) || (elementAudioBelongsToTrack(existingTrack) && !audio.paused && !audio.ended)) {
          if (isSavedTrack(existingTrack)) {
            if (existingTrack.webAudioPlaying) {
              existingTrack.pausedByUser = true;
              stopWebAudioPlayback("pause");
              setStatus("已暂停");
              showTrackNotice(existingTrack, "已暂停", "点播放从当前位置继续");
              return;
            }
            try {
              existingTrack.lastElementSec = Math.max(0, Number(audio.currentTime || 0) || 0);
              audio.pause();
              setTrackPlaybackState(existingTrack, "paused");
              setPlayState("idle");
              setStatus("已暂停");
              showTrackNotice(existingTrack, "已暂停", "点播放从当前位置继续");
            } catch (_) {}
          } else {
            pauseLiveTrack(existingTrack);
          }
          return;
        }
        if ((isLiveTrack(existingTrack) || trackState(existingTrack) === "pending") && play && play.dataset.state === "loading") {
          pauseLiveTrack(existingTrack);
          return;
        }
        if (shouldUseElementForSavedTrack(existingTrack)) {
          if (cfg.offlineAudioEnabled) await hydrateOfflineAudio(existingTrack, "play");
          var existingUrl = trackPlayableUrl(existingTrack);
          if (shouldUseWebAudioForSavedTrack(existingTrack)) {
            await playSavedTrack(existingTrack, trackResumeSec(existingTrack), {
              label: "play saved",
              noticeTitle: trackResumeSec(existingTrack) > 0 ? "从断点继续播放" : "读取已保存音频…",
              noticeDetail: "手机端使用 Web Audio 播放已保存音频"
            });
            return;
          }
          var audioUrl = audio.currentSrc || audio.src || "";
          if (existingUrl && !elementAudioBelongsToTrack(existingTrack) && audioUrl !== existingUrl) {
            startElementAudioFrom(existingTrack, trackResumeSec(existingTrack));
          } else if (audio.src) {
            if (audio.paused) { setAudioPlaybackRate(); await audio.play().catch(function(e){ handleAudioPlayReject("element", e, "请点播放继续"); }); }
            else audio.pause();
          } else {
            startElementAudioFrom(existingTrack, trackResumeSec(existingTrack));
          }
          return;
        }
        if (isLiveTrack(existingTrack) || trackState(existingTrack) === "pending") {
          if (existingTrack.cacheKey && await refreshTrackFromStatus(existingTrack, "play snapshot")) {
            if (shouldUseElementForSavedTrack(existingTrack)) {
              if (cfg.offlineAudioEnabled) await hydrateOfflineAudio(existingTrack, "play saved");
              await playSavedTrack(existingTrack, trackResumeSec(existingTrack), {
                label: "play snapshot saved",
                noticeTitle: "播放已保存音频",
                noticeDetail: "生成已完成，切到保存音频"
              });
              return;
            }
          }
          var liveUrl = liveStreamUrlForTrack(existingTrack);
          if (liveUrl) {
            var manualResumeSec = trackResumeSec(existingTrack);
            existingTrack.allowStreamPlay = false;
            setStatus(manualResumeSec > 0 ? "从断点继续…" : "连接流式音频…");
            showTrackNotice(existingTrack, manualResumeSec > 0 ? "从断点继续播放" : "连接流式音频", manualResumeSec > 0 ? ("从 " + formatTime(manualResumeSec) + " 继续，后台仍在合成") : "后台仍在合成，连接后从断点继续");
            await playLiveTrack(existingTrack, liveUrl, {
              noticeTitle: manualResumeSec > 0 ? "从断点继续播放" : "连接流式音频",
              noticeDetail: manualResumeSec > 0 ? ("从 " + formatTime(manualResumeSec) + " 继续，后台仍在合成") : "后台仍在合成，连接后从断点继续",
              waitDetail: "等待后端继续输出 PCM",
              startOffsetSec: manualResumeSec
            });
            return;
          }
          setTrackPlaybackState(existingTrack, "error");
          setPlayState("idle");
          setStatus(existingTrack.cacheKey ? "音频已失效，点 + 重新生成" : "还没有音频，点 + 生成");
          showTrackNotice(existingTrack, existingTrack.cacheKey ? "需要重新生成" : "还没有音频", existingTrack.cacheKey ? "原流式任务已结束且无保存音频，点 + 重新生成" : "点 + 号开始生成");
          return;
        }
        if (audio.src) {
          if (audio.paused) { setAudioPlaybackRate(); await audio.play().catch(function(e){ handleAudioPlayReject("element", e, "请点播放继续"); }); }
          else audio.pause();
          return;
        }
        // 没 src 但有卡片 → 选当前卡片，让 selectTrack 决定 URL 来源
        await selectTrack(currentTrackIndex, true);
        return;
      }
      var voiceProblem = validateVoiceMappingForGenerate();
      if (voiceProblem) {
        setError(voiceProblem);
        showTrackNotice(null, "音色映射未配置", voiceProblem);
        return;
      }
      // 兼容旧逻辑（无卡片 + audio.src 残留时）
      if (audio.src && !force && generatedTracks.length === 0) {
        if (audio.paused) {
          setAudioPlaybackRate();
          await audio.play().catch(function(e){ handleAudioPlayReject("element", e, "请点播放继续"); });
        } else audio.pause();
        return;
      }

      // ★ Bug 修复:点 ▶ / 🎵 第一时间 push 占位卡片,让用户立刻看见一张
      // "生成中…" 卡。后续的 LLM 拆段 + dialogue job 拿到 cacheKey 会
      // 原地把这张卡的属性填上(url, cacheKey, segments...),不会再 push 新的。
      var placeholder = null;
      if (cfg.mode === "ai8") {
        placeholder = {
          url: null,
          streamUrl: "",
          cacheUrl: "",
          cacheKey: "",
          createdAt: Date.now(),
          voice: cfg.defaultVoice,
          mode: cfg.mode,
          segments: [],
          state: "pending",
          status: "pending",
          pendingBlob: true,
        };
        generatedTracks.push(placeholder);
        currentTrackIndex = generatedTracks.length - 1;
        // 关键:重置 audio.src / seek / 标题 到新卡片,否则旧 audio 还在播,UI 错位
        try { audio.pause(); } catch (_) {}
        await selectTrack(currentTrackIndex, false);
        setStatus("准备生成…");
        showTrackNotice(placeholder, "准备生成…", "等待 LLM 分析文本");
        debugLog("🎵 立即 push 占位卡片(currentTrackIndex=" + currentTrackIndex + ")", "#9ff");
      }

      setPlayState("loading");
      try {
        var base = cleanBase(cfg.apiBase), body, url;
        if (cfg.mode === "ai8") {
          setStatus("AI 分析中…");
          showTrackNotice(placeholder, "AI 分析中…", "正在拆分旁白、人物和声腔");
          var t0 = Date.now();
          debugLog("━━━━━━━━━━━━━━━━━━━━━━━━━", "#fff");
          debugLog("🎬 多音色生成开始 (text=" + messageText.length + " 字)", "#fff");
          startServerLogPolling(base);
          var segments = splitSegmentsForSynthesis(await parseWithOptionalReuse(messageText, cfg, setStatus, context));
          if (placeholder && placeholder.deleted) throw Object.assign(new Error("生成已取消"), { name: "AbortError" });
          var roleCounts = {}; segments.forEach(function (s) { roleCounts[s.role] = (roleCounts[s.role] || 0) + 1; });
          var roleSummary = Object.keys(roleCounts).map(function (r) { return r + "×" + roleCounts[r]; }).join(", ");
          setStatus("开始合成 " + segments.length + " 段…");
          showTrackNotice(placeholder, "开始合成 " + segments.length + " 段…", roleSummary);
          var voicesMap = rolesListToVoicesMap(cfg.roleVoiceList, cfg.defaultVoice, cfg.currentCharacterName, context);
          var missingRoles = missingVoiceRolesForSegments(segments, voicesMap);
          if (missingRoles.length) {
            throw new Error("LLM 返回了未配置音色的角色：" + missingRoles.join("、") + "。请在“角色音色映射”里添加这些名字，或把它们写进用户身份别名。");
          }
          debugLog("🎙️ 音色映射: " + JSON.stringify(voicesMap), "#ffd479");
          body = Object.assign({ segments: segments, voices: voicesMap, performance_mode: cfg.qualityMode || "balanced", interval_ms: cfg.intervalMs, top_p: cfg.topP, top_k: cfg.topK, temperature: cfg.temperature, repetition_penalty: cfg.repetitionPenalty, speed_factor: clampNumber(cfg.speedFactor || 1.0, 1.0, 0.85, 1.25) }, generationQualityOverrides(cfg.qualityMode));
          if (force) {
            body.bypass_cache = true;
            body.request_id = generationRequestId("dialogue");
            debugLog("🎵 新建 dialogue 音频 request_id=" + body.request_id, "#9ff");
          }
          var ttsStart = Date.now();
          var jobInfo;
          var ttsTimer = setInterval(function () {
            var sec = Math.floor((Date.now() - ttsStart) / 1000);
            setStatus("合成中 " + sec + "s…");
            showTrackNotice(placeholder, "合成中 " + sec + "s…", "等待首块音频返回");
          }, 1000);
          try {
            debugLog("📡 提交 dialogue job", "#ffd479");
            body = stripNullishFields(body);
            jobInfo = await createDialogueStreamJob(base, body);
            debugLog("🔗 cache_key=" + jobInfo.cacheKey + " cached=" + jobInfo.cached + " live=" + jobInfo.live, "#9f9");
          } finally {
            clearInterval(ttsTimer);
          }
          if (placeholder && placeholder.deleted) {
            if (jobInfo && jobInfo.cacheKey) deleteRemoteTrack({ cacheKey: jobInfo.cacheKey }).catch(function () {});
            throw Object.assign(new Error("生成已取消"), { name: "AbortError" });
          }
          var streamUrl = jobInfo.streamUrl;
          var cacheUrl = jobInfo.cacheUrl;
          // 复用第一时间 push 的占位卡片(placeholder),原地填字段。这样
          // 不会出现"先一张占位 + 后一张真卡片"两张卡。
          var trackEntry = placeholder || {
            url: null,
            createdAt: Date.now(),
            voice: cfg.defaultVoice,
            mode: cfg.mode,
            pendingBlob: true,
          };
          trackEntry.streamUrl = streamUrl;
          trackEntry.cacheUrl = cacheUrl;
          trackEntry.cacheKey = jobInfo.cacheKey;
          trackEntry.segments = segments;
          trackEntry.voicesMap = voicesMap;
          trackEntry.streamInterrupted = false;
          trackEntry.streamStalled = false;
          trackEntry.stalledCount = 0;
          trackEntry.streamHealth = "ok";
          trackEntry.savePromptAsked = false;
          trackEntry.allowStreamPlay = true;
          trackEntry.backgroundOnly = false;
          setTrackState(trackEntry, jobInfo.cached ? "saved" : "live");
          if (!placeholder) {
            // 防御性:正常路径下 placeholder 一定有,这里兜底
            generatedTracks.push(trackEntry);
            currentTrackIndex = generatedTracks.length - 1;
          }
          updateTrackButtons();
          if (messageId) {
            saveTracksForMessage(messageId, generatedTracks).catch(function(){});
            debugLog("💾 立即写 tavo.set cacheKey=" + jobInfo.cacheKey, "#9ff");
          }
          if (trackEntry.pausedByUser) {
            setStatus("已暂停，后台保存中");
            showTrackNotice(trackEntry, "已暂停", "合成还在后台进行，保存后会成为历史音频");
            pollCacheUpgrade(trackEntry, "paused snapshot");
            stopServerLogPolling();
            return;
          }
          // 如果服务端早就有这条音频的缓存，走完整音频播放器；这是可拖动进度条的路径。
          if (jobInfo.cached && cacheUrl) {
            trackEntry.url = cacheUrl;
            trackEntry.backgroundOnly = false;
            setTrackState(trackEntry, "saved");
            await prepareOfflineAudio(trackEntry, "cached hit", { saveMissing: true });
            setStatus("已有音频，正在播放");
            showTrackNotice(trackEntry, trackEntry.offlineUrl ? "本机缓存音频" : "已有音频", trackEntry.offlineUrl ? "已从 IndexedDB 读取" : "已加载音频，支持拖动");
            setPlayState("loading");
            debugLog(trackEntry.offlineUrl ? "⚡ 命中本机缓存音频，直接播放" : "⚡ 命中服务端缓存，准备播放", "#9f9");
            await playSavedTrack(trackEntry, 0, { label: "cached hit", noticeTitle: "已有音频，正在播放", noticeDetail: trackEntry.offlineUrl ? "已从 IndexedDB 读取" : "已从服务端缓存读取" });
            return;
          }
          if (jobInfo.live && streamUrl) {
            trackEntry.url = streamUrl;
            trackEntry.backgroundOnly = false;
            trackEntry.allowStreamPlay = true;
            trackEntry.playSavedWhenReady = false;
            setTrackState(trackEntry, "live");
            setStatus("连接流式音频…");
            showTrackNotice(trackEntry, "连接流式音频…", "边合成边播放，完成后自动保存缓存");
            debugLog("▶️ dialogue live stream 播放: " + streamUrl, "#9f9");
            pollCacheUpgrade(trackEntry, "dialogue live snapshot");
            await playLiveTrack(trackEntry, streamUrl, {
              noticeTitle: "等待首段音频…",
              noticeDetail: "边合成边播放，完成后自动保存缓存",
              waitDetail: "正在合成第一段",
              startOffsetSec: 0
            });
            return;
          }
          trackEntry.backgroundOnly = true;
          trackEntry.allowStreamPlay = false;
          trackEntry.playSavedWhenReady = true;
          trackEntry.stopServerLogWhenReady = true;
          setTrackPlaybackState(trackEntry, "loading");
          setPlayState("loading");
          setStatus("后台合成中…");
          showTrackNotice(trackEntry, "后台合成中…", "当前多段声腔先生成落盘，完成后自动播放");
          debugLog("⏳ dialogue 后台生成，等待 cacheUrl 就绪后播放，避免假流式卡住", "#ffd479");
          pollCacheUpgrade(trackEntry, "dialogue background snapshot");
          return;
        } else {
          var singleJob = await createSingleStreamJob(base, cfg, messageText, force);
          var singleTrack = {
            url: singleJob.cacheUrl || singleJob.streamUrl,
            streamUrl: singleJob.streamUrl,
            cacheUrl: singleJob.cacheUrl,
            cacheKey: singleJob.cacheKey,
            deleteUrl: singleDeleteUrl(base, cfg, messageText),
            createdAt: Date.now(),
            voice: cfg.defaultVoice,
            mode: cfg.mode,
            state: singleJob.cacheUrl ? "saved" : "live",
            status: singleJob.cacheUrl ? "ready" : "running",
            pendingBlob: !singleJob.cacheUrl,
            streaming: !singleJob.cacheUrl,
            streamInterrupted: false,
            streamStalled: false,
            stalledCount: 0,
            streamHealth: "ok",
            savePromptAsked: false,
            allowStreamPlay: false
          };
          setTrackState(singleTrack, singleJob.cacheUrl ? "saved" : "live");
          if (singleJob.cacheUrl) await prepareOfflineAudio(singleTrack, singleJob.cached ? "single cached hit" : "single generated", { saveMissing: true });
          generatedTracks.push(singleTrack);
          await selectTrack(generatedTracks.length - 1, false);
          if (messageId) saveTracksForMessage(messageId, generatedTracks).catch(function(){});
          if (singleJob.cacheUrl) {
            setStatus(singleJob.cached ? "已有单音色音频" : "单音色音频已保存");
            showTrackNotice(
              currentTrack(),
              singleJob.cached ? (singleTrack.offlineUrl ? "本机缓存音频" : "已有单音色音频") : "单音色音频已保存",
              "点播放开始，可拖动进度条"
            );
            setPlayState("idle");
            return;
          }
          setStatus("正在生成单音色音频...");
          showTrackNotice(currentTrack(), "正在生成单音色音频…", "生成完成后点播放开始");
        }
      } catch (e) {
        var msg = errorMessage(e, "生成失败，但浏览器没有给出具体原因。请看上一条请求日志和后端日志。");
        var isAbort = (e && e.name === 'AbortError') || /aborted/i.test(msg);
        setPlayState("idle");
        stopServerLogPolling();
        // 切卡/切角色导致的 AbortError 是正常用户操作,不弹红色错误
        if (isAbort) {
          setStatus("已取消");
          debugLog("⏸ 生成被中断(切卡/切角色等): " + msg, "#fc9");
        } else {
          setStatus("生成失败");
          setError(msg);
          debugLog("❌ 错误: " + msg, "#f99");
        }
        // 生成失败 → 从列表里删掉占位卡片,避免留死卡
        if (placeholder) {
          var idx = generatedTracks.indexOf(placeholder);
          if (idx >= 0) {
            generatedTracks.splice(idx, 1);
            if (currentTrackIndex >= generatedTracks.length) currentTrackIndex = generatedTracks.length - 1;
            updateTrackButtons();
            debugLog("🗑 移除失败的占位卡片", "#fc9");
          }
        }
      }
    }
