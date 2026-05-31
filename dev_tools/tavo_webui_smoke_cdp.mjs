import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = process.cwd();
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) {
  throw new Error("Chrome/Edge executable not found");
}

const port = Number(process.env.CDP_PORT || 9333);
const testUrl = process.env.TAVO_TEST_URL || "http://127.0.0.1:9880/tavo_test?ttsDebug=1";
const userDataDir = path.join(ROOT, "outputs", `chrome-tavo-smoke-${Date.now()}`);
fs.mkdirSync(userDataDir, { recursive: true });

const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "--remote-allow-origins=*",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--autoplay-policy=no-user-gesture-required",
  testUrl,
], { stdio: "ignore" });

async function fetchJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(250);
  }
  throw lastErr || new Error(`timeout fetching ${url}`);
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const consoleLines = [];
  const requests = [];
  const responses = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result || {});
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = (msg.params.args || []).map((arg) => arg.value ?? arg.description ?? "").join(" ");
      consoleLines.push(text);
    }
    if (msg.method === "Network.requestWillBeSent") {
      requests.push({ method: msg.params.request.method, url: msg.params.request.url });
    }
    if (msg.method === "Network.responseReceived") {
      responses.push({ status: msg.params.response.status, url: msg.params.response.url, mime: msg.params.response.mimeType });
    }
  });

  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  async function send(method, params = {}) {
    await opened;
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000).unref();
    });
  }

  async function evalJs(expression, awaitPromise = false) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  }

  async function waitFor(expression, timeoutMs = 120000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await evalJs(expression).catch(() => false);
      if (value) return value;
      await sleep(500);
    }
    throw new Error(`waitFor timeout: ${expression}`);
  }

  return { send, evalJs, waitFor, consoleLines, requests, responses, close: () => ws.close() };
}

async function pageSummary(cdp) {
  return await cdp.evalJs(`(() => {
    const log = window.__idxTest && window.__idxTest.getFetchLog ? window.__idxTest.getFetchLog() : [];
    const audio = document.querySelector('audio[data-role="audio"]');
    const status = document.querySelector('[data-role="status"]');
    const error = document.querySelector('[data-role="error"]');
    const play = document.querySelector('[data-role="play"]');
    return {
      bodyText: document.body.textContent.slice(0, 1000),
      fetches: log.map((r) => ({ method: r.method, path: new URL(r.url).pathname })).slice(-40),
      statusText: status ? status.textContent : "",
      errorText: error ? error.textContent : "",
      playState: play ? play.dataset.state : "",
      addExists: !!document.querySelector('[data-role="add"]'),
      audioSrc: audio ? audio.currentSrc || audio.src || "" : "",
      audioReadyState: audio ? audio.readyState : -1,
      audioError: audio && audio.error ? audio.error.code : 0,
      coverBg: (document.querySelector('[data-role="cover"]') || {}).style ? document.querySelector('[data-role="cover"]').style.backgroundImage : "",
      mediaArtwork: navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artwork
        ? navigator.mediaSession.metadata.artwork.map((a) => ({ src: a.src, type: a.type, sizes: a.sizes }))
        : [],
    };
  })()`);
}

function urlPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function isLiveDialoguePath(url) {
  return /\/tts_dialogue_stream_job\/[^/]+$/.test(urlPath(url));
}

function voicePreviewRequestCount(cdp) {
  return cdp.requests.filter((r) => /\/voice_preview$/.test(urlPath(r.url))).length;
}

async function waitUntil(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await sleep(500);
  }
  throw new Error(`waitUntil timeout: ${label}`);
}

function latestCacheKeyFromConsole(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = String(lines[i]).match(/cache_key=([0-9a-f]{40})/i);
    if (m) return m[1];
  }
  return "";
}

try {
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find((t) => t.type === "page" && t.url.includes("/tavo_test")) || targets.find((t) => t.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("no page target found");

  const cdp = connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");

  await cdp.waitFor("document.readyState === 'complete'");
  await cdp.waitFor("!!document.querySelector('[data-role=\"lazy-play\"]')", 30000);
  await cdp.evalJs(`(() => {
    const text = document.getElementById("messageText");
    const avatar = document.getElementById("characterAvatar");
    text.value = "WebUI smoke " + Date.now() + "：她停在门口，轻声问今天还要不要继续。\\n\\n潘金莲低声说：「我先小声说一句，你听得到吗？」";
    avatar.value = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22512%22%20height%3D%22512%22%20viewBox%3D%220%200%20512%20512%22%3E%3Crect%20width%3D%22512%22%20height%3D%22512%22%20fill%3D%22%235a2240%22%2F%3E%3Ccircle%20cx%3D%22256%22%20cy%3D%22212%22%20r%3D%2292%22%20fill%3D%22%23ffd4e8%22%2F%3E%3Cpath%20d%3D%22M112%20454c28-88%2094-132%20144-132s116%2044%20144%20132%22%20fill%3D%22%23ffd4e8%22%2F%3E%3C%2Fsvg%3E";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    avatar.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("mountBtn").click();
    return true;
  })()`);
  await cdp.waitFor("!!document.querySelector('[data-role=\"lazy-play\"]')", 30000);
  const lazyBeforeMount = await cdp.evalJs(`(() => ({
    hasLazy: !!document.querySelector('[data-role="lazy-card"]'),
    hasFull: !!document.querySelector('[data-role="add"]'),
    hasPanel: !!document.querySelector('.idx-panel'),
    hasLazyGear: !!document.querySelector('[data-role="lazy-gear"]'),
    lazyButtonCount: document.querySelectorAll('[data-role="lazy-card"] button').length,
    hasLazyMain: !!document.querySelector('[data-role="lazy-open"]'),
    lazyStatus: (document.querySelector('[data-role="lazy-status"]') || {}).textContent || "",
    runtimeRequested: window.__idxTest.getFetchLog().some((r) => new URL(r.url).pathname.indexOf('/static/tavo.runtime.js') >= 0)
  }))()`);

  let pickerCheck = null;
  try {
    const previewBefore = voicePreviewRequestCount(cdp);
    pickerCheck = await cdp.evalJs(`(async () => {
      function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
      async function waitFor(fn, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const v = fn();
          if (v) return v;
          await sleep(100);
        }
        throw new Error("picker wait timeout");
      }
      const lazyPlay = document.querySelector('[data-role="lazy-play"]');
      lazyPlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      lazyPlay.click();
      await waitFor(() => document.querySelector('[data-role="gear"]'), 5000);
      const guardedVoiceBtn = document.querySelector('[data-role="default-voice-btn"]') || document.querySelector('.idx-role-row .idx-voice-btn');
      if (guardedVoiceBtn) {
        guardedVoiceBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
        guardedVoiceBtn.click();
      }
      await sleep(600);
      const pickerOpenAfterLazyPlay = !!document.querySelector('.idx-picker[open]');
      const panelOpenAfterLazyPlay = !!document.querySelector('.idx-panel[open]');
      await sleep(1200);
      const gear = document.querySelector('[data-role="gear"]');
      gear.click();
      await waitFor(() => document.querySelector('.idx-panel[open]'), 5000);
      const beforeY = window.scrollY;
      const panel = document.querySelector('.idx-panel[open]');
      const panelBox = panel.getBoundingClientRect();
      const panelFixed = getComputedStyle(panel).position === 'fixed';
      const panelInViewport = panelBox.top >= -2 && panelBox.bottom <= window.innerHeight + 2;
      const quality = document.querySelector('[data-field="qualityMode"]');
      quality.value = "expressive";
      quality.dispatchEvent(new Event("input", { bubbles: true }));
      quality.dispatchEvent(new Event("change", { bubbles: true }));
      function isVisible(el) {
        if (!el) return false;
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      }
      const firstVoiceBtn = Array.from(document.querySelectorAll('[data-role="default-voice-btn"], .idx-role-row .idx-voice-btn')).find(isVisible);
      if (!firstVoiceBtn) throw new Error("visible voice button not found");
      firstVoiceBtn.click();
      const picker = await waitFor(() => document.querySelector('.idx-picker[open]'), 10000);
      const item = await waitFor(() => document.querySelector('.idx-picker[open] .idx-picker-item'), 30000);
      const pickerHeight = Math.round(picker.getBoundingClientRect().height);
      const pickerItems = document.querySelectorAll('.idx-picker[open] .idx-picker-item').length;
      const panelWasOpenWithPicker = !!document.querySelector('.idx-panel[open]');
      const closeBtn = document.querySelector('.idx-picker[open] .idx-picker-close');
      closeBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
      await waitFor(() => !document.querySelector('.idx-picker[open]') && document.querySelector('.idx-panel[open]'), 5000);
      const closeButtonWorked = !document.querySelector('.idx-picker[open]') && !!document.querySelector('.idx-panel[open]');
      firstVoiceBtn.click();
      await waitFor(() => document.querySelector('.idx-picker[open] .idx-picker-item'), 10000);
      const itemAfterClose = document.querySelector('.idx-picker[open] .idx-picker-item');
      itemAfterClose.click();
      await waitFor(() => !document.querySelector('.idx-picker[open]') && document.querySelector('.idx-panel[open]'), 5000);
      const panelRestored = !!document.querySelector('.idx-panel[open]');
      quality.value = "expressive";
      quality.dispatchEvent(new Event("input", { bubbles: true }));
      quality.dispatchEvent(new Event("change", { bubbles: true }));
      const selectedQuality = document.querySelector('[data-field="qualityMode"]').value;
      document.querySelector('[data-role="save"]').click();
      await sleep(100);
      const bucket = window.__idxTest.storageBucket();
      const globalCfg = bucket["global:gptsovits_tavo_config_v1"] || {};
      const charCfg = bucket["character:gptsovits_tavo_character_config_v1"] || {};
      const globalCharacterKeys = Object.keys(bucket).filter((key) => key.startsWith("global:gptsovits_tavo_character_v1:"));
      const globalHasVoiceConfig = ["defaultVoice", "roleVoiceList", "roleVoicesText"].some((key) => Object.prototype.hasOwnProperty.call(globalCfg, key));
      const characterHasVoiceConfig = !!(charCfg.defaultVoice && Array.isArray(charCfg.roleVoiceList) && charCfg.roleVoiceList.length);
      window.__idxTest.clearFetchLog();
      return { pickerHeight, pickerItems, panelWasOpenWithPicker, panelRestored, closeButtonWorked, selectedQuality, globalHasVoiceConfig, characterHasVoiceConfig, globalCharacterKeys, panelFixed, panelInViewport, scrollDelta: Math.abs(window.scrollY - beforeY), pickerOpenAfterLazyPlay, panelOpenAfterLazyPlay };
    })()`, true);
    await sleep(500);
    pickerCheck.voicePreviewNetworkDelta = voicePreviewRequestCount(cdp) - previewBefore;
  } catch (error) {
    console.log(JSON.stringify({ ok: false, stage: "voice-picker-quality-setup", error: error.message, summary: await pageSummary(cdp), consoleLines: cdp.consoleLines.slice(-80), pickerCheck }, null, 2));
    process.exitCode = 1;
    cdp.close();
    throw error;
  }

  await cdp.evalJs(`document.querySelector('[data-role="add"]').click(); true`);

  try {
    await cdp.waitFor(`(() => {
    const log = window.__idxTest && window.__idxTest.getFetchLog ? window.__idxTest.getFetchLog() : [];
    return log.some((r) => /\\/tts_dialogue_stream_job$/.test(new URL(r.url).pathname));
  })()`, 30000);
  } catch (error) {
    console.log(JSON.stringify({ ok: false, stage: "wait-dialogue-job", error: error.message, summary: await pageSummary(cdp), consoleLines: cdp.consoleLines.slice(-80) }, null, 2));
    process.exitCode = 1;
    cdp.close();
    throw error;
  }

  try {
    await cdp.waitFor(`(() => {
    const audio = document.querySelector('audio[data-role="audio"]');
    const src = audio ? (audio.currentSrc || audio.src || "") : "";
    const log = window.__idxTest && window.__idxTest.getFetchLog ? window.__idxTest.getFetchLog() : [];
    const liveFetch = log.some((r) => /\\/tts_dialogue_stream_job\\/[^/]+$/.test(new URL(r.url).pathname));
    return ((/\\/tts_dialogue_stream_job\\/[^/]+$/.test(src) || /\\/cache_audio\\//.test(src)) && audio.readyState >= 2) || liveFetch;
  })()`, 180000);
  } catch (error) {
    console.log(JSON.stringify({ ok: false, stage: "wait-live-audio", error: error.message, summary: await pageSummary(cdp), consoleLines: cdp.consoleLines.slice(-80), pickerCheck }, null, 2));
    process.exitCode = 1;
    cdp.close();
    throw error;
  }

  try {
    await waitUntil(() => cdp.consoleLines.some((line) => /dialogue live snapshot 已落盘/.test(line)), 180000, "dialogue live snapshot");
  } catch (error) {
    console.log(JSON.stringify({ ok: false, stage: "wait-cache-snapshot", error: error.message, summary: await pageSummary(cdp), consoleLines: cdp.consoleLines.slice(-80), pickerCheck }, null, 2));
    process.exitCode = 1;
    cdp.close();
    throw error;
  }

  const countsBeforeReuse = await cdp.evalJs(`(() => {
    const log = window.__idxTest.getFetchLog();
    return {
      parse: log.filter((r) => new URL(r.url).pathname === "/parse_text").length,
      dialogue: log.filter((r) => new URL(r.url).pathname === "/tts_dialogue_stream_job").length
    };
  })()`);
  await cdp.evalJs(`document.querySelector('[data-role="add"]').click(); true`);
  await cdp.waitFor(`(() => {
    const log = window.__idxTest.getFetchLog();
    return log.filter((r) => new URL(r.url).pathname === "/tts_dialogue_stream_job").length >= ${countsBeforeReuse.dialogue + 1};
  })()`, 30000);

  const summary = await cdp.evalJs(`(() => {
    const log = window.__idxTest.getFetchLog();
    const audio = document.querySelector('audio[data-role="audio"]');
    const status = document.querySelector('[data-role="status"]');
    const play = document.querySelector('[data-role="play"]');
    return {
      fetches: log.map((r) => ({ method: r.method, path: new URL(r.url).pathname })).slice(-20),
      parseCount: log.filter((r) => new URL(r.url).pathname === "/parse_text").length,
      dialogueCount: log.filter((r) => new URL(r.url).pathname === "/tts_dialogue_stream_job").length,
      parseHasLegacyEmotionFields: log
        .filter((r) => new URL(r.url).pathname === "/parse_text")
        .some((r) => /八情绪|emo_vec|emo_alpha/.test(r.body || "")),
      statusText: status ? status.textContent : "",
      playState: play ? play.dataset.state : "",
      audioSrc: audio ? audio.currentSrc || audio.src || "" : "",
      audioReadyState: audio ? audio.readyState : -1,
      audioDuration: audio ? audio.duration : null,
      coverBg: (document.querySelector('[data-role="cover"]') || {}).style ? document.querySelector('[data-role="cover"]').style.backgroundImage : "",
      mediaArtwork: navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artwork
        ? navigator.mediaSession.metadata.artwork.map((a) => ({ src: a.src, type: a.type, sizes: a.sizes }))
        : [],
      consoleTail: ${JSON.stringify(cdp.consoleLines)}.slice(-30)
    };
  })()`);

  const remountSnapshot = await cdp.evalJs(`(async () => {
    function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
    async function waitFor(fn, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const v = fn();
        if (v) return v;
        await sleep(100);
      }
      return null;
    }
    document.getElementById("mountBtn").click();
    const lazy = await waitFor(() => document.querySelector('[data-role="lazy-card"]'), 5000);
    const status = document.querySelector('[data-role="lazy-status"]');
    return {
      hasLazy: !!lazy,
      hasFull: !!document.querySelector('[data-role="add"]'),
      hasLazyGear: !!document.querySelector('[data-role="lazy-gear"]'),
      lazyButtonCount: document.querySelectorAll('[data-role="lazy-card"] button').length,
      lazyStatus: status ? status.textContent : ""
    };
  })()`, true);

  const hasCacheAudio = /\/cache_audio\//.test(summary.audioSrc) ||
    cdp.responses.some((r) => /\/cache_audio\//.test(r.url) && r.status >= 200 && r.status < 300);
  const cacheKey = latestCacheKeyFromConsole(cdp.consoleLines);
  const cacheSnapshotOk = !!cacheKey && fs.existsSync(path.join(ROOT, "outputs", "cache", `${cacheKey}.json`));
  const hasLiveStream = /\/tts_dialogue_stream_job\/[^/]+$/.test(summary.audioSrc) ||
    cdp.requests.some((r) => r.method === "GET" && isLiveDialoguePath(r.url)) ||
    cdp.responses.some((r) => isLiveDialoguePath(r.url) && r.status >= 200 && r.status < 300);
  const hasLiveConsole = cdp.consoleLines.some((line) => /dialogue live stream 播放/.test(line));
  const hasBackgroundConsole = cdp.consoleLines.some((line) => /dialogue 后台生成/.test(line));
  const parseCount = summary.parseCount;
  const reusedParse = cdp.consoleLines.some((line) => /复用 LLM 拆段/.test(line));
  const hasDialogueJob = summary.dialogueCount >= 2;
  const hasStatus = summary.fetches.some((r) => /\/tts_dialogue_job_status\//.test(r.path));
  const failedConsole = cdp.consoleLines.filter((line) => /❌|error code=4|服务端推理失败|HTTP 422|has no prompt_text|八情绪|emo=\[/i.test(line));
  const noLegacyEmotionPrompt = !summary.parseHasLegacyEmotionFields;
  const pickerOk = !!pickerCheck &&
    pickerCheck.selectedQuality === "expressive" &&
    pickerCheck.panelWasOpenWithPicker === false &&
    pickerCheck.panelRestored === true &&
    pickerCheck.voicePreviewNetworkDelta === 0 &&
    pickerCheck.globalHasVoiceConfig === false &&
    pickerCheck.characterHasVoiceConfig === true &&
    pickerCheck.globalCharacterKeys.length === 0 &&
    pickerCheck.closeButtonWorked === true &&
    pickerCheck.panelFixed === true &&
    pickerCheck.panelInViewport === true &&
    pickerCheck.scrollDelta <= 2 &&
    pickerCheck.pickerOpenAfterLazyPlay === false &&
    pickerCheck.panelOpenAfterLazyPlay === false;
  const mediaArtworkOk = !summary.mediaArtwork.length ||
    (summary.mediaArtwork[0].src && !/tavo-now-playing-cover\.png/.test(summary.mediaArtwork[0].src));
  const runtimeLazyLoaded = cdp.requests.some((r) => new URL(r.url).pathname.includes('/static/tavo.runtime.js')) ||
    cdp.responses.some((r) => new URL(r.url).pathname.includes('/static/tavo.runtime.js') && r.status >= 200 && r.status < 300);
  const remountSnapshotOk = remountSnapshot.hasLazy && !remountSnapshot.hasFull && !remountSnapshot.hasLazyGear && remountSnapshot.lazyButtonCount === 1 && /历史音频\s+[1-9]/.test(remountSnapshot.lazyStatus);

  console.log(JSON.stringify({
    ok: lazyBeforeMount.hasLazy && lazyBeforeMount.hasLazyMain && /历史音频/.test(lazyBeforeMount.lazyStatus) && !lazyBeforeMount.hasFull && !lazyBeforeMount.hasPanel && !lazyBeforeMount.hasLazyGear && lazyBeforeMount.lazyButtonCount === 1 && !lazyBeforeMount.runtimeRequested && runtimeLazyLoaded && remountSnapshotOk && hasDialogueJob && hasLiveStream && hasLiveConsole && !hasBackgroundConsole && cacheSnapshotOk && parseCount <= 1 && reusedParse && noLegacyEmotionPrompt && pickerOk && mediaArtworkOk && failedConsole.length === 0,
    lazyBeforeMount,
    remountSnapshot,
    remountSnapshotOk,
    runtimeLazyLoaded,
    hasDialogueJob,
    hasStatus,
    hasLiveStream,
    hasLiveConsole,
    hasBackgroundConsole,
    hasCacheAudio,
    cacheKey,
    cacheSnapshotOk,
    parseCount,
    reusedParse,
    noLegacyEmotionPrompt,
    pickerOk,
    pickerCheck,
    mediaArtworkOk,
    failedConsole,
    summary,
  }, null, 2));

  cdp.close();
} finally {
  chrome.kill();
  await sleep(500);
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {}
}
