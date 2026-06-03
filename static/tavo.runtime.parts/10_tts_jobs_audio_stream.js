// GPT-SoVITS Tavo runtime part: 10_tts_jobs_audio_stream.js // Source: static/tavo.runtime.js lines 901-1500 before physical split. // Role: TTS request builders and Web Audio streaming // This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script. 
  function defaultStyleAlpha(style, cfg) {
    style = normalizeStyleId(style);
    var hit = STYLE_PRESETS.find(function (s) { return s.id === style; });
    if (hit) return Math.min(hit.alpha, style === "neutral" ? 0.20 : 0.66);
    return 0.38;
  }
  function llmMaxTokensForText(text) {
    return Math.min(12000, Math.max(4000, Math.ceil(String(text || "").length * 5)));
  }
  function normalizeCoverageText(value) {
    return String(value || "")
      .replace(/[\s\u3000]/g, "")
      .replace(/[「」『』“”"‘’'（）()《》〈〉【】\[\]{}]/g, "")
      .replace(/[，。！？；：、,.!?;:…—\-~～·]/g, "");
  }
  function tailNarrationAfterQuote(value) {
    var text = String(value || "").trim();
    var lastClose = Math.max(
      text.lastIndexOf("」"),
      text.lastIndexOf("』"),
      text.lastIndexOf("”"),
      text.lastIndexOf("\"")
    );
    if (lastClose < 0 || lastClose >= text.length - 1) return "";
    var tail = text.slice(lastClose + 1).trim();
    if (!tail || !/[\u4e00-\u9fffA-Za-z0-9]/.test(tail)) return "";
    return tail;
  }
  function assertLlmSegmentsCoverSource(sourceText, segments) {
    var sourceNorm = normalizeCoverageText(sourceText);
    var joinedNorm = normalizeCoverageText((segments || []).map(function (s) { return s.text || ""; }).join(""));
    if (!sourceNorm || !joinedNorm) return;
    if (sourceNorm !== joinedNorm) {
      var tailLen = Math.min(32, sourceNorm.length);
      var sourceTail = sourceNorm.slice(-tailLen);
      var joinedTail = joinedNorm.slice(-tailLen);
      var diff = Math.abs(sourceNorm.length - joinedNorm.length);
      var tolerance = Math.max(12, Math.ceil(sourceNorm.length * 0.02));
      if (sourceTail !== joinedTail || diff > tolerance) {
        debugLog("⚠️ LLM 覆盖差异：原文约 " + sourceNorm.length + " 字，返回约 " + joinedNorm.length + " 字，差 " + diff + " 字。原文尾部=" + sourceTail + "；返回尾部=" + joinedTail, "#fc9");
        return;
      }
      debugLog("⚠️ LLM 覆盖校验发现轻微差异但已放行：原文约 " + sourceNorm.length + " 字，返回约 " + joinedNorm.length + " 字，差 " + diff + " 字。", "#fc9");
    }
    var tail = tailNarrationAfterQuote(sourceText);
    if (tail && segments && segments.length) {
      var last = segments[segments.length - 1];
      if ((last.role || "") !== "旁白") {
        debugLog("⚠️ LLM 尾段可能应为旁白：当前 role=" + (last.role || "?") + "，尾部=" + tail.slice(0, 40), "#fc9");
      }
    }
  }
  function escapeRegExpText(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function quoteDepthAt(sourceText, idx) {
    var depth = 0;
    var asciiQuoteOpen = false;
    var text = String(sourceText || "");
    for (var i = 0; i < Math.max(0, idx); i++) {
      var ch = text.charAt(i);
      if (ch === "「" || ch === "『" || ch === "“") depth += 1;
      else if (ch === "」" || ch === "』" || ch === "”") depth = Math.max(0, depth - 1);
      else if (ch === '"') asciiQuoteOpen = !asciiQuoteOpen;
    }
    return depth + (asciiQuoteOpen ? 1 : 0);
  }
  function findSegmentTextInSource(sourceText, segmentText, fromIdx) {
    var text = String(segmentText || "").trim();
    if (!text) return -1;
    var src = String(sourceText || "");
    var idx = src.indexOf(text, Math.max(0, fromIdx || 0));
    if (idx >= 0) return idx;
    return src.indexOf(text);
  }
  function looksLikeNarrationSegment(text, role) {
    var s = String(text || "").trim();
    if (!s || /[「」『』“”"]/.test(s)) return false;
    var verbs = "(低下|抬起|低头|抬头|看着|望着|看见|听见|感觉|走|站|坐|躺|靠|伸|抱|搂|抓|攥|咬|闭|睁|转|笑|哭|喘|颤|缩|贴|凑|伏|跪|垂|松|捂|揉|摸|按|亲|吻|加快|放慢|停下|开始|尖叫|叫|张开|流|滴|仰|扭|摇|晃|动|沉浸|起伏)";
    if (new RegExp("^我" + verbs).test(s)) return true;
    if (new RegExp("^[他她它]" + verbs).test(s)) return true;
    role = String(role || "").trim();
    if (role && role !== "旁白" && role !== "用户") {
      return new RegExp("^" + escapeRegExpText(role) + verbs).test(s);
    }
    return false;
  }
  function singleParams(cfg, text) {
    var p = new URLSearchParams();
    p.set("text", text);
    p.set("ref_audio_path", cfg.defaultVoice);
    p.set("top_p", String(cfg.topP));
    p.set("top_k", String(cfg.topK));
    p.set("temperature", String(cfg.temperature));
    p.set("repetition_penalty", String(cfg.repetitionPenalty));
    applyGenerationParamsToSearchParams(p, cfg);
    return p;
  }
  function singleStreamUrl(base, cfg, text, force) {
    var p = singleParams(cfg, text);
    if (force) {
      p.set("bypass_cache", "1");
      p.set("_t", String(Date.now()));
    }
    return cleanBase(base) + cfg.endpoint + "?" + p.toString();
  }
  function singleDeleteUrl(base, cfg, text) {
    return cleanBase(base) + "/cache_tts_single?" + singleParams(cfg, text).toString();
  }
  function generationRequestId(kind) {
    var rnd = "";
    try {
      var c = window.crypto || window.msCrypto;
      if (c && c.getRandomValues) {
        var a = new Uint32Array(2);
        c.getRandomValues(a);
        rnd = a[0].toString(36) + a[1].toString(36);
      }
    } catch (_) {}
    if (!rnd) rnd = Math.random().toString(36).slice(2);
    return String(kind || "tts") + "-" + Date.now().toString(36) + "-" + rnd;
  }
  function singleBody(cfg, text, force) {
    var body = Object.assign({
      text: text,
      ref_audio_path: cfg.defaultVoice,
      top_p: cfg.topP,
      top_k: cfg.topK,
      temperature: cfg.temperature,
      repetition_penalty: cfg.repetitionPenalty,
      bypass_cache: !!force
    }, generationQualityOverrides(cfg.qualityMode));
    if (force) body.request_id = generationRequestId("single");
    return body;
  }
  async function createSingleStreamJob(base, cfg, text, force) {
    var res = await adapterJsonPost(cleanBase(base) + "/tts_stream_job", singleBody(cfg, text, force));
    if (!res.ok) {
      var singleErr = await res.text().catch(function () { return ""; });
      throw new Error("单音色 TTS job 后端返回 HTTP " + res.status + (singleErr ? ":\n" + singleErr : "，响应为空"));
    }
    var data = await res.json();
    if (!data || !data.url) throw new Error("后端没有返回流式播放地址。");
    return {
      streamUrl: new URL(data.url, cleanBase(base) + "/").href,
      cacheUrl: data.cache_url ? new URL(data.cache_url, cleanBase(base) + "/").href : "",
      cacheKey: data.cache_key || "",
      cached: !!data.cached,
      live: !!data.live
    };
  }

  async function createDialogueStreamJob(base, body) {
    var res = await adapterJsonPost(cleanBase(base) + "/tts_dialogue_stream_job", body);
    if (!res.ok) {
      var dialogueErr = await res.text().catch(function () { return ""; });
      throw new Error("多音色 TTS job 后端返回 HTTP " + res.status + (dialogueErr ? ":\n" + dialogueErr : "，响应为空"));
    }
    var data = await res.json();
    if (!data || !data.url) throw new Error("后端没有返回流式播放地址。");
    return {
      streamUrl: new URL(data.url, cleanBase(base) + "/").href,
      cacheUrl: data.cache_url ? new URL(data.cache_url, cleanBase(base) + "/").href : "",
      cacheKey: data.cache_key || "",
      cached: !!data.cached,
      live: !!data.live,
    };
  }

  function isMobileUA() {
    try { return /Android|iPhone|iPad|iPod|Mobile|Phone|MicroMessenger/i.test(navigator.userAgent || ""); }
    catch (_) { return false; }
  }

  // 在用户点击事件里同步创建并 resume AudioContext。iOS Safari 要求 audio
  // 必须在 user gesture 里激活；后面经过 await saveConfig / await parseWithLlm
  // 之后才创建的 ctx 会停在 suspended，永远不出声。
  var PRIMED_CTX = null;
  var PRIMED_UNLOCK_SOURCE = null;
  var FORCE_NEW_AUDIO_CONTEXT = false;
  var AUDIO_KEEPALIVE_SOURCE = null;
  var AUDIO_KEEPALIVE_GAIN = null;
  function stopAudioKeepalive(reason) {
    try {
      if (window.__gptsovits_tavo_preprimed_keepalive_source) window.__gptsovits_tavo_preprimed_keepalive_source.stop(0);
    } catch (_) {}
    try {
      if (window.__gptsovits_tavo_preprimed_keepalive_source) window.__gptsovits_tavo_preprimed_keepalive_source.disconnect();
    } catch (_) {}
    try {
      if (window.__gptsovits_tavo_preprimed_keepalive_gain) window.__gptsovits_tavo_preprimed_keepalive_gain.disconnect();
    } catch (_) {}
    try {
      window.__gptsovits_tavo_preprimed_keepalive_source = null;
      window.__gptsovits_tavo_preprimed_keepalive_gain = null;
    } catch (_) {}
    try {
      if (AUDIO_KEEPALIVE_SOURCE) AUDIO_KEEPALIVE_SOURCE.stop(0);
    } catch (_) {}
    try {
      if (AUDIO_KEEPALIVE_SOURCE) AUDIO_KEEPALIVE_SOURCE.disconnect();
    } catch (_) {}
    try {
      if (AUDIO_KEEPALIVE_GAIN) AUDIO_KEEPALIVE_GAIN.disconnect();
    } catch (_) {}
    AUDIO_KEEPALIVE_SOURCE = null;
    AUDIO_KEEPALIVE_GAIN = null;
    try { debugLog("🔇 AudioContext keepalive stopped: " + (reason || ""), "#9ff"); } catch (_) {}
  }
  function startAudioKeepalive(ctx, reason) {
    if (!ctx || AUDIO_KEEPALIVE_SOURCE) return;
    try {
      var rate = ctx.sampleRate || 44100;
      var frames = Math.max(1, Math.floor(rate * 0.5));
      var b = ctx.createBuffer(1, frames, rate);
      var ch = b.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = 0.00001;
      var gain = ctx.createGain ? ctx.createGain() : null;
      var s = ctx.createBufferSource();
      s.buffer = b;
      s.loop = true;
      if (gain) {
        gain.gain.value = 0.00001;
        s.connect(gain);
        gain.connect(ctx.destination);
      } else {
        s.connect(ctx.destination);
      }
      s.start(0);
      AUDIO_KEEPALIVE_SOURCE = s;
      AUDIO_KEEPALIVE_GAIN = gain;
      debugLog("🔇 AudioContext keepalive started: " + (reason || ""), "#9ff");
    } catch (e) {
      try { debugLog("⚠️ AudioContext keepalive 启动失败: " + errorMessage(e, "keepalive 启动失败"), "#fc9"); } catch (_) {}
      stopAudioKeepalive("start failed");
    }
  }
  function resetPrimedAudioContext(reason) {
    FORCE_NEW_AUDIO_CONTEXT = true;
    stopAudioKeepalive(reason || "reset");
    try {
      if (PRIMED_UNLOCK_SOURCE) PRIMED_UNLOCK_SOURCE.stop(0);
    } catch (_) {}
    PRIMED_UNLOCK_SOURCE = null;
    var old = PRIMED_CTX;
    PRIMED_CTX = null;
    try { window.__gptsovits_tavo_preprimed_audio_context = null; } catch (_) {}
    try {
      if (old && old.state !== "closed" && typeof old.close === "function") {
        var p = old.close();
        if (p && typeof p.catch === "function") p.catch(function () {});
      }
    } catch (_) {}
    try { debugLog("⚠️ AudioContext 已重置: " + (reason || "unknown"), "#fc9"); } catch (_) {}
  }
  function audioContextBlockedError(step, ctx) {
    var state = "unknown";
    try { state = String((ctx && ctx.state) || "unknown"); } catch (_) {}
    resetPrimedAudioContext(step + ":" + state);
    return new Error("[step:" + step + "] AudioContext state=" + state + "，音频通道未放行");
  }
  function primeAudioContext() {
    if (!PRIMED_CTX && !FORCE_NEW_AUDIO_CONTEXT) {
      try {
        var pre = window.__gptsovits_tavo_preprimed_audio_context;
        if (pre && typeof pre.createBufferSource === "function") PRIMED_CTX = pre;
      } catch (_) {}
    }
    if (PRIMED_CTX) {
      try {
        if (FORCE_NEW_AUDIO_CONTEXT || PRIMED_CTX.state === "closed" || PRIMED_CTX.state === "interrupted") {
          resetPrimedAudioContext("prime stale " + String(PRIMED_CTX.state || "unknown"));
        }
      } catch (_) {
        resetPrimedAudioContext("prime state read failed");
      }
    }
    if (PRIMED_CTX) {
      try { if (PRIMED_CTX.state === "suspended") PRIMED_CTX.resume(); } catch (_) {}
      startAudioKeepalive(PRIMED_CTX, "prime existing");
      return PRIMED_CTX;
    }
    FORCE_NEW_AUDIO_CONTEXT = false;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      var ctx = new AC();
      // 立刻 resume + 播一段 1 帧静音解锁 iOS 音频通道
      try { ctx.resume(); } catch (_) {}
      try {
        var unlockRate = ctx.sampleRate || 44100;
        var b = ctx.createBuffer(1, Math.max(1, Math.floor(unlockRate * 0.03)), unlockRate);
        var ch = b.getChannelData(0);
        if (ch && ch.length) ch[0] = 0.0005;
        var s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
        PRIMED_UNLOCK_SOURCE = s;
        s.onended = function () { if (PRIMED_UNLOCK_SOURCE === s) PRIMED_UNLOCK_SOURCE = null; };
      } catch (_) {}
      PRIMED_CTX = ctx;
      startAudioKeepalive(ctx, "prime new");
      return ctx;
    } catch (_) { return null; }
  }

  // 真流式播放：用 Web Audio API 直接拉 chunked-WAV 的 ReadableStream，
  // 解析 WAV 头后把 PCM 块逐段塞进 AudioContext。完全不走 <audio> 元素，
  // 因此不受手机浏览器 "Content-Length 未知就报错" 的限制。
  // hooks: { onStateChange(state), onError(err), debug(text), playbackRate }
  async function streamWavViaWebAudio(streamUrl, hooks) {
    hooks = hooks || {};
    var playbackRate = Math.max(0.85, Math.min(1.25, Number(hooks.playbackRate || 1) || 1));
    var startOffsetSec = Math.max(0, Number(hooks.startOffsetSec || 0) || 0);
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("浏览器不支持 Web Audio API");
    hooks.onStateChange && hooks.onStateChange("connecting");
    // 优先复用 user-gesture 里 prime 出来的 ctx；没有再 new 一个（桌面/file://
    // 这种没经过 gesture 的场景也能跑）。
    var ctx = PRIMED_CTX || new AC();
    PRIMED_CTX = ctx;
    try { if (ctx.state === "suspended") await ctx.resume(); }
    catch (e) { throw new Error("[step:resume] " + errorMessage(e, "AudioContext resume 失败")); }
    if (String(ctx.state || "running") !== "running") {
      throw audioContextBlockedError("resume", ctx);
    }
    var output = ctx.createGain ? ctx.createGain() : null;
    if (output) {
      output.gain.value = 1;
      output.connect(ctx.destination);
    }
    var activeSources = [];
    var reader = null;
    var stopped = false;
    var stopReason = "";
    var endTimer = null;
    var started = false;
    var nextAt = 0;
    var playbackStartCtxTime = null;
    var readEnded = false;
    var bufferTimer = null;
    var playNotifyTimer = null;
    var bufferingState = false;
    var scheduledSpans = [];
    var scheduledAudioSec = 0;
    function getPlaybackTimeSec() {
      if (!started || !scheduledSpans.length) return 0;
      var now = 0;
      try { now = ctx.currentTime || 0; } catch (_) { now = 0; }
      for (var i = 0; i < scheduledSpans.length; i++) {
        var sp = scheduledSpans[i];
        if (now < sp.start) return sp.audioStart;
        if (now >= sp.start && now <= sp.end) return sp.audioStart + ((now - sp.start) * playbackRate);
      }
      return scheduledSpans[scheduledSpans.length - 1].audioEnd;
    }
    function armEndedWatcher() {
      if (endTimer) { try { clearInterval(endTimer); } catch (_) {} endTimer = null; }
      if (bufferTimer) { try { clearInterval(bufferTimer); } catch (_) {} bufferTimer = null; }
      endTimer = setInterval(function () {
        if (stopped) {
          try { clearInterval(endTimer); } catch (_) {}
          endTimer = null;
          return;
        }
        var now = 0;
        try { now = ctx.currentTime || 0; } catch (_) { now = 0; }
        // 用 AudioContext 时钟判断结束；WebView 暂停/弱网卡住时 currentTime 不会乱跑。
        if (nextAt && now + 0.03 >= nextAt) {
          try { clearInterval(endTimer); } catch (_) {}
          endTimer = null;
          hooks.onStateChange && hooks.onStateChange("ended");
        }
      }, 120);
    }
    function armBufferWatcher() {
      if (bufferTimer) return;
      bufferTimer = setInterval(function () {
        if (stopped || readEnded || !started) return;
        var now = 0;
        try { now = ctx.currentTime || 0; } catch (_) { now = 0; }
        var ahead = nextAt - now;
        if (ahead <= 0.12 && !bufferingState) {
          bufferingState = true;
          hooks.onStateChange && hooks.onStateChange("buffering");
        } else if (bufferingState && ahead >= 0.65) {
          bufferingState = false;
          hooks.onStateChange && hooks.onStateChange("resumed");
        }
      }, 120);
    }
    function makeAbortError(reason) {
      var e = new Error(reason || "播放已停止");
      e.name = "AbortError";
      return e;
    }
    function stopWebAudio(reason) {
      stopped = true;
      stopReason = reason || "播放已停止";
      if (endTimer) { try { clearInterval(endTimer); } catch (_) {} endTimer = null; }
      if (bufferTimer) { try { clearInterval(bufferTimer); } catch (_) {} bufferTimer = null; }
      if (playNotifyTimer) { try { clearTimeout(playNotifyTimer); } catch (_) {} playNotifyTimer = null; }
      activeSources.slice().forEach(function (node) { try { node.stop(0); } catch (_) {} });
      if (reader && typeof reader.cancel === "function") {
        try { reader.cancel(stopReason).catch(function () {}); } catch (_) {}
      }
      hooks.onStateChange && hooks.onStateChange("stopped");
    }
    if (hooks.onController) hooks.onController({ stop: stopWebAudio, getTimeSec: getPlaybackTimeSec });
    function connectNode(node) {
      node.connect(output || ctx.destination);
    }
    function keepSource(node) {
      activeSources.push(node);
      node.onended = function () {
        var idx = activeSources.indexOf(node);
        if (idx >= 0) activeSources.splice(idx, 1);
      };
    }
    if (hooks.debug) hooks.debug("AudioContext state=" + ctx.state + " sr=" + ctx.sampleRate);

    var res;
    try { res = await fetch(streamUrl, { cache: "no-store" }); }
    catch (e) { throw new Error("[step:fetch] " + errorMessage(e, "音频流请求失败")); }
    if (!res.ok) throw new Error("[step:fetch] HTTP " + res.status + " " + (await res.text().catch(function(){return"";})));
    hooks.onStateChange && hooks.onStateChange("connected");

    // 试 ReadableStream 真流式；如果 WebView 不支持 (常见于 iOS 老版 / 部分
    // Android WebView)，退回 arrayBuffer 全下载后整段解码播。
    var canStream = !!(res.body && typeof res.body.getReader === "function");
    if (canStream) {
      try { reader = res.body.getReader(); }
      catch (e) { canStream = false; hooks.debug && hooks.debug("getReader 抛异常, 退回 arrayBuffer: " + errorMessage(e, "ReadableStream 不可用")); }
    }

    if (!canStream) {
      hooks.debug && hooks.debug("无 ReadableStream 支持，走 arrayBuffer 整段解码");
      var ab;
      try { ab = await res.arrayBuffer(); }
      catch (e) { throw new Error("[step:arrayBuffer] " + errorMessage(e, "读取音频内容失败")); }
      var audioBuf;
      try { audioBuf = await ctx.decodeAudioData(ab.slice(0)); }
      catch (e) { throw new Error("[step:decodeAudioData] " + errorMessage(e, "音频解码失败")); }
      var src;
      try {
        src = ctx.createBufferSource();
        src.buffer = audioBuf;
        try { src.playbackRate.value = playbackRate; } catch (_) {}
        connectNode(src);
        keepSource(src);
        var audioOffset = Math.min(startOffsetSec, Math.max(0, audioBuf.duration - 0.05));
        var fallbackStartAt = ctx.currentTime + 0.03;
        var dur = Math.max(0, audioBuf.duration - audioOffset) / playbackRate;
        playbackStartCtxTime = fallbackStartAt;
        nextAt = fallbackStartAt + dur;
        scheduledSpans.push({ start: fallbackStartAt, end: nextAt, audioStart: audioOffset, audioEnd: audioBuf.duration });
        scheduledAudioSec = audioBuf.duration;
        started = true;
        src.start(fallbackStartAt, audioOffset);
      } catch (e) { throw new Error("[step:bufferSource.start] " + errorMessage(e, "启动音频失败")); }
      hooks.onStateChange && hooks.onStateChange("scheduled");
      playNotifyTimer = setTimeout(function () {
        playNotifyTimer = null;
        if (stopped) return;
        ensureAudioContextRunning("playNotify").then(function () {
          if (!stopped && String(ctx.state || "running") === "running") hooks.onStateChange && hooks.onStateChange("playing");
          else if (!stopped) hooks.onStateChange && hooks.onStateChange("audio_suspended");
        }).catch(function (e) {
          hooks.onError && hooks.onError(e);
          if (!stopped) hooks.onStateChange && hooks.onStateChange("audio_suspended");
        });
      }, Math.max(0, (fallbackStartAt - (ctx.currentTime || 0)) * 1000 + 40));
      armEndedWatcher();
      return { ctx: ctx, duration: dur, mode: "buffered" };
    }

    var pending = new Uint8Array(0);
    function appendPending(chunk) {
      if (!chunk || !chunk.length) return;
      var nb = new Uint8Array(pending.length + chunk.length);
      nb.set(pending); nb.set(chunk, pending.length); pending = nb;
    }
    async function pullMore() {
      try {
        if (stopped) throw makeAbortError(stopReason);
        var r = await reader.read();
        if (r.done) return false;
        appendPending(r.value);
        return true;
      } catch (e) { throw new Error("[step:reader.read] " + errorMessage(e, "读取音频流失败")); }
    }
    function findDataOffset(arr) {
      for (var i = 12; i + 8 <= arr.length; i++) {
        if (arr[i] === 0x64 && arr[i+1] === 0x61 && arr[i+2] === 0x74 && arr[i+3] === 0x61) return i + 8;
      }
      return -1;
    }

    while (pending.length < 44) {
      if (stopped) throw makeAbortError(stopReason);
      if (!(await pullMore())) throw new Error("[step:wavHeader] WAV 头未到先断流");
    }
    var hv = new DataView(pending.buffer, pending.byteOffset, pending.byteLength);
    var channels = hv.getUint16(22, true);
    var sampleRate = hv.getUint32(24, true);
    var bitsPerSample = hv.getUint16(34, true);
    if (bitsPerSample !== 16) throw new Error("[step:wavHeader] 只支持 16-bit PCM, 实际 bits=" + bitsPerSample);
    var dataOff = findDataOffset(pending);
    while (dataOff < 0) {
      if (!(await pullMore())) throw new Error("[step:wavHeader] 没找到 WAV data 段就断流");
      dataOff = findDataOffset(pending);
    }
    if (hooks.debug) hooks.debug("WAV header parsed: sr=" + sampleRate + " ch=" + channels + " bits=" + bitsPerSample);
    hooks.onStateChange && hooks.onStateChange("waiting_pcm");
    var pcm = pending.slice(dataOff);
    pending = null;

    var startAt = ctx.currentTime + 0.06;
    nextAt = startAt;
    started = false;
    playbackStartCtxTime = null;
    var bytesPerSec = sampleRate * channels * 2;
    var blockAlign = Math.max(2 * channels, 2);
    var skipBytesRemaining = Math.floor(startOffsetSec * bytesPerSec);
    skipBytesRemaining = skipBytesRemaining - (skipBytesRemaining % blockAlign);
    if (skipBytesRemaining > 0 && hooks.debug) hooks.debug("resume offset " + startOffsetSec.toFixed(2) + "s, skip " + skipBytesRemaining + " PCM bytes");
    scheduledAudioSec = skipBytesRemaining > 0 ? startOffsetSec : scheduledAudioSec;
    // 本机/LAN 也可能因为首段内部 chunk 间隔出现 underrun。起播前多攒一点
    // PCM，避免刚显示 playing 就立刻 buffering。
    var flushBytes = Math.max(8192, Math.floor(bytesPerSec * 0.50));
    flushBytes = flushBytes - (flushBytes % blockAlign);
    if (flushBytes < blockAlign) flushBytes = blockAlign;
    var startBufferBytes = Math.max(flushBytes, Math.floor(bytesPerSec * 5.00));
    startBufferBytes = startBufferBytes - (startBufferBytes % blockAlign);
    if (startBufferBytes < flushBytes) startBufferBytes = flushBytes;
    var interrupted = false;
    startAt = ctx.currentTime + 0.12;
    nextAt = startAt;

    async function ensureAudioContextRunning(step) {
      try {
        if (ctx.state === "suspended") {
          await ctx.resume();
          hooks.debug && hooks.debug(step + " resume AudioContext -> " + ctx.state);
        }
      } catch (e) {
        throw new Error("[step:" + step + ".resume] " + errorMessage(e, "AudioContext resume 失败"));
      }
      if (String(ctx.state || "running") !== "running") {
        throw audioContextBlockedError(step + ".resume", ctx);
      }
    }

    async function schedulePcm(bytes) {
      if (bytes.length < 2 * channels) return;
      try {
        if (stopped) throw makeAbortError(stopReason);
        await ensureAudioContextRunning("schedulePcm");
        var samples = Math.floor(bytes.length / (2 * channels));
        var aBuf = ctx.createBuffer(channels, samples, sampleRate);
        var view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2 * channels);
        for (var c = 0; c < channels; c++) {
          var chan = aBuf.getChannelData(c);
          for (var i = 0; i < samples; i++) {
            chan[i] = view.getInt16((i * channels + c) * 2, true) / 32768;
          }
        }
        var src = ctx.createBufferSource();
        src.buffer = aBuf;
        try { src.playbackRate.value = playbackRate; } catch (_) {}
        connectNode(src);
        keepSource(src);
        var t = Math.max(nextAt, ctx.currentTime + 0.02);
        src.start(t);
        var realDur = aBuf.duration / playbackRate;
        var audioStart = scheduledAudioSec;
        var audioEnd = audioStart + aBuf.duration;
        nextAt = t + realDur;
        scheduledSpans.push({ start: t, end: nextAt, audioStart: audioStart, audioEnd: audioEnd });
        scheduledAudioSec = audioEnd;
        if (!started) {
          playbackStartCtxTime = t;
          started = true;
          hooks.onStateChange && hooks.onStateChange("scheduled");
          playNotifyTimer = setTimeout(function () {
            playNotifyTimer = null;
            if (stopped) return;
            ensureAudioContextRunning("playNotify").then(function () {
              if (!stopped && String(ctx.state || "running") === "running") hooks.onStateChange && hooks.onStateChange("playing");
              else if (!stopped) hooks.onStateChange && hooks.onStateChange("audio_suspended");
            }).catch(function (e) {
              hooks.onError && hooks.onError(e);
              if (!stopped) hooks.onStateChange && hooks.onStateChange("audio_suspended");
            });
          }, Math.max(0, (t - (ctx.currentTime || 0)) * 1000 + 40));
          armBufferWatcher();
        } else if (bufferingState && nextAt - (ctx.currentTime || 0) >= 0.65) {
          bufferingState = false;
          hooks.onStateChange && hooks.onStateChange("resumed");
        }
      } catch (e) {
        throw new Error("[step:schedulePcm] " + errorMessage(e, "PCM 排程失败"));
      }
    }

    function alignedLength(n) {
      n = Math.max(0, Math.floor(n || 0));
      return n - (n % blockAlign);
    }
    function applyStartOffsetSkip() {
      if (!skipBytesRemaining || !pcm || !pcm.length) return;
      var canDrop = Math.min(alignedLength(pcm.length), skipBytesRemaining);
      if (canDrop <= 0) return;
      pcm = pcm.slice(canDrop);
      skipBytesRemaining -= canDrop;
      if (skipBytesRemaining <= 0) {
        skipBytesRemaining = 0;
        if (hooks.debug) hooks.debug("resume offset reached, scheduling from " + startOffsetSec.toFixed(2) + "s");
      }
    }
    async function scheduleStartIfReady(force) {
      if (started || !pcm) return false;
      applyStartOffsetSkip();
      if (skipBytesRemaining > 0) return false;
      var needBytes = force ? blockAlign : startBufferBytes;
      if (pcm.length < needBytes) return false;
      var firstChunkBytes = force ? alignedLength(pcm.length) : alignedLength(Math.min(pcm.length, Math.max(startBufferBytes, flushBytes)));
      if (firstChunkBytes <= 0) return false;
      hooks.onStateChange && hooks.onStateChange("first_pcm");
      var firstSlice = pcm.slice(0, firstChunkBytes);
      pcm = pcm.slice(firstChunkBytes);
      await schedulePcm(firstSlice);
      return true;
    }

    while (true) {
      var r;
      try { r = await reader.read(); }
      catch (e) {
        if (stopped) throw makeAbortError(stopReason);
        if (started) {
          // 已经起播后读流失败，按真实失败处理；不再继续播放残留 buffer，
          // 也不做断线恢复，避免弱网下重复尾段/乱跳。
          interrupted = true;
          readEnded = true;
          hooks.onStateChange && hooks.onStateChange("interrupted");
          hooks.debug && hooks.debug("流中断，停止 Web Audio: " + errorMessage(e, "读取音频流中断"));
          stopWebAudio("stream interrupted");
          throw new Error("[step:reader.read.loop] " + errorMessage(e, "读取音频流中断"));
        }
        hooks.onError && hooks.onError(e);
        throw new Error("[step:reader.read.loop] " + errorMessage(e, "读取音频流失败"));
      }
      if (r.done) { readEnded = true; break; }
      if (r.value && r.value.length) {
        var nb = new Uint8Array(pcm.length + r.value.length);
        nb.set(pcm); nb.set(r.value, pcm.length); pcm = nb;
      }
      applyStartOffsetSkip();
      await scheduleStartIfReady(false);
      while (started && pcm.length >= flushBytes) {
        var slice = pcm.slice(0, flushBytes);
        pcm = pcm.slice(flushBytes);
        await schedulePcm(slice);
      }
    }
    if (!started) await scheduleStartIfReady(true);
    applyStartOffsetSkip();
    if (skipBytesRemaining > 0) {
      pcm = null;
    } else if (pcm && pcm.length >= blockAlign) {
      var remainLen = alignedLength(pcm.length);
      if (remainLen > 0) await schedulePcm(pcm.slice(0, remainLen));
    }
    pcm = null;
    if (!started) throw new Error("[step:noAudio] 后端没有返回可播放音频");
    if (stopped) return { ctx: ctx, duration: Math.max(0, nextAt - startAt), mode: "streaming", stopped: true, interrupted: interrupted };

    var totalDur = Math.max(0, nextAt - startAt);
    armEndedWatcher();
    return { ctx: ctx, duration: totalDur, mode: "streaming", interrupted: interrupted };
  }

  async function parseWithLlm(text, cfg, setStatus, context) {
    var llmStart = Date.now();
    setStatus("步骤 1/3：请求后端 LLM 代理…");
    debugLog("🤖 LLM 代理请求开始: model=" + (cfg.llmModel || "(后端配置)") + ", endpoint=" + (cfg.llmEndpoint || "(后端配置)") + ", textLen=" + text.length, "#ffd479");
    // 把当前角色映射的 role 名作为「已知角色」注入 prompt,让 LLM 输出的 role 字段
    // 跟前端 voicesMap 严格对齐(否则后端归一可能错位)。
    context = context || {};
    var userName = String(context.userName || "").trim();
    var userAliases = normalizedUserAliases(context);
    var userAliasText = userAliases.length ? userAliases.join(" / ") : (userName || "未读取到");
    var currentCharacterName = String(context.characterName || "").trim();
    var knownRoles = ((cfg.roleVoiceList || []).map(function (r) { return String(r.role || "").trim(); }).filter(function (r) { return r && r !== "角色" && r !== "我"; }));
    if (knownRoles.indexOf("旁白") < 0) knownRoles.unshift("旁白");
    if (knownRoles.indexOf("用户") < 0) knownRoles.splice(1, 0, "用户");
    if (currentCharacterName && knownRoles.indexOf(currentCharacterName) < 0) knownRoles.push(currentCharacterName);
    var rolesHint = "已知角色名单(LLM 输出 role 字段必须从这里选,或者用剧情里出现的新人物名):\n  " + knownRoles.join(" / ") + "\n";
    var userAliasHint = "用户身份名/别名: " + userAliasText + "。只有原文中的「你」以及这些身份名/别名明确指向玩家/读者时，role 才写 \"用户\"。";
    var userProfileHint = context.userDescription ? "用户身份资料(只用于判断别名，不朗读): " + shortText(context.userDescription, 900) : "";
    var characterHint = "当前角色名: " + (currentCharacterName || "未读取到") + "。原文第一人称「我」通常指当前角色或正在自述的人物，不要因为出现「我」就改成用户。";
    var prompt = [
      "你是中文小说→TTS 片段拆分器。只返回严格 JSON，不要任何解释，不要 ``` 代码块。",
      "",
      rolesHint,
      userAliasHint,
      userProfileHint,
      characterHint,
      "输出格式：",
      "{\"segments\":[{\"role\":\"...\",\"text\":\"...\",\"style\":\"neutral\",\"style_alpha\":0.2}]}",
      "",
      "拆段规则：",
      "1. 旁白（叙述、环境、动作描写、心理描写、所有无引号正文）→ role 固定为 \"旁白\"。",
      "   无论主语是不是用户身份名/当前角色名，只要不是引号里的直接台词，都必须写 \"旁白\"。",
      "   例如「白夜雨抱住她」「潘金莲低下头」「她笑了」「我低下头看着……」「白夜雨说道：」都写旁白，不要让用户或角色认领旁白。",
      "   ⚠️ 旁白的 style 永远写 neutral，style_alpha 写 0.15。",
      "       旁白是叙述者，本身不使用声腔参考；后端也会强制覆盖成 neutral。",
      "   ⚠️ 旁白连续多个句子，要按句号/问号/感叹号/分号 拆成多个旁白 segments，每段≤2 句。",
      "       不要把整段旁白合并成一条 segment 偷懒。例：「她抬头看了我一眼。她哭了。」要拆成两条。",
      "2. 人物直接说出口的话 → role 用说话人的名字。",
