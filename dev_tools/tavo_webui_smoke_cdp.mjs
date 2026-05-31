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
    };
  })()`);
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
  await cdp.waitFor("!!document.querySelector('[data-role=\"add\"]')", 30000);
  await cdp.evalJs(`(() => {
    const text = document.getElementById("messageText");
    text.value = "WebUI smoke " + Date.now() + "：她停在门口，轻声问今天还要不要继续。\\n\\n潘金莲低声说：「我先小声说一句，你听得到吗？」";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("mountBtn").click();
    return true;
  })()`);
  await cdp.waitFor("!!document.querySelector('[data-role=\"add\"]')", 30000);
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
    return /\\/cache_audio\\//.test(src) && audio.readyState >= 2;
  })()`, 180000);
  } catch (error) {
    console.log(JSON.stringify({ ok: false, stage: "wait-cache-audio", error: error.message, summary: await pageSummary(cdp), consoleLines: cdp.consoleLines.slice(-80) }, null, 2));
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
      consoleTail: ${JSON.stringify(cdp.consoleLines)}.slice(-30)
    };
  })()`);

  const hasCacheAudio = /\/cache_audio\//.test(summary.audioSrc) ||
    cdp.responses.some((r) => /\/cache_audio\//.test(r.url) && r.status >= 200 && r.status < 300);
  const parseCount = summary.parseCount;
  const reusedParse = cdp.consoleLines.some((line) => /复用 LLM 拆段/.test(line));
  const hasDialogueJob = summary.fetches.some((r) => r.path === "/tts_dialogue_stream_job");
  const hasStatus = summary.fetches.some((r) => /\/tts_dialogue_job_status\//.test(r.path));
  const failedConsole = cdp.consoleLines.filter((line) => /❌|error code=4|服务端推理失败|HTTP 422|has no prompt_text|八情绪|emo=\[/i.test(line));
  const noLegacyEmotionPrompt = !summary.parseHasLegacyEmotionFields;

  console.log(JSON.stringify({
    ok: hasDialogueJob && hasCacheAudio && parseCount === 1 && reusedParse && noLegacyEmotionPrompt && failedConsole.length === 0,
    hasDialogueJob,
    hasStatus,
    hasCacheAudio,
    parseCount,
    reusedParse,
    noLegacyEmotionPrompt,
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
