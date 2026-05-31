from __future__ import annotations

import io
import json
import os
import queue
import threading
import time
import wave
from pathlib import Path
from typing import Any, Optional
from urllib import error, request as urlrequest

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

from gsv_adapter import llm_proxy, profile_store, snapshot_cache, voice_library


APP = FastAPI(title="GPT-SoVITS Tavo Local Adapter")
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-GPT-SoVITS-Cache-Key"],
)
ROOT = Path(__file__).resolve().parent
STYLE_DIR = ROOT / "prompts" / "library" / "声腔"
OFFICIAL_TTS_URL = os.getenv("GPT_SOVITS_OFFICIAL_TTS_URL", "http://127.0.0.1:9881/tts")


STYLE_ALIASES = {
    "neutral": "",
    "breath_soft": "breath_soft",
    "breath_heavy": "breath_heavy",
    "intimate_breath": "intimate_breath",
    "moan_soft": "moan_soft",
    "low_murmur": "low_murmur",
    "whisper_soft": "whisper_soft",
    "shy_whisper": "shy_whisper",
    "tense_breath": "tense_breath",
    "sob_soft": "sob_soft",
    "cry_soft": "cry_soft",
    "tease_soft": "tease_soft",
    "laugh_soft": "laugh_soft",
    "gasp_surprise": "gasp_surprise",
    "scream_peak": "scream_peak",
    "stage_warmup": "breath_soft",
    "stage_rising": "intimate_breath",
    "stage_peak": "scream_peak",
    "stage_afterglow": "low_murmur",
}


JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()
JOB_QUEUE: queue.Queue[tuple[str, dict[str, Any], dict[str, Optional[dict[str, Any]]]]] = queue.Queue()
WORKER_STARTED = False


class ProfileSaveRequest(BaseModel):
    name: str
    data: dict[str, Any]


class UsageLogRequest(BaseModel):
    event_type: str
    payload: dict[str, Any]


class ParseTextRequest(BaseModel):
    text: str
    endpoint: str
    model: str
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: float = 0.2
    timeout: float = 60
    max_tokens: Optional[int] = None


class DialogueStreamRequest(BaseModel):
    segments: list[dict[str, Any]] = Field(default_factory=list)
    voices: dict[str, str] = Field(default_factory=dict)
    top_p: float = 1.0
    top_k: int = 15
    temperature: float = 1.0
    speed_factor: float = 1.0
    streaming_mode: int | bool = 2
    performance_mode: str = "balanced"
    sample_steps: Optional[int] = None
    batch_size: Optional[int] = None
    parallel_infer: Optional[bool] = None
    text_split_method: Optional[str] = None
    aux_ref_audio_paths: list[str] = Field(default_factory=list)


class SingleStreamRequest(BaseModel):
    text: str = ""
    ref_audio_path: str = ""
    top_p: float = 1.0
    top_k: int = 15
    temperature: float = 1.0
    repetition_penalty: float = 1.35
    speed_factor: float = 1.0
    diffusion_steps: Optional[int] = None
    sample_steps: Optional[int] = None
    batch_size: Optional[int] = None
    parallel_infer: Optional[bool] = None
    text_split_method: Optional[str] = None
    bypass_cache: bool = False


@APP.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "engine": "gptsovits-adapter"}


@APP.get("/static/tavo.js")
async def tavo_js() -> FileResponse:
    return FileResponse(ROOT / "static" / "tavo.js", media_type="application/javascript")


@APP.head("/static/tavo.js")
async def tavo_js_head() -> FileResponse:
    return FileResponse(ROOT / "static" / "tavo.js", media_type="application/javascript")


@APP.get("/tavo_test")
async def tavo_test() -> HTMLResponse:
    path = ROOT / "static" / "tavo_widget_test.html"
    if path.is_file():
        return HTMLResponse(path.read_text(encoding="utf-8"))
    return HTMLResponse('<script src="/static/tavo.js"></script>')


@APP.get("/p2_test")
async def p2_test() -> FileResponse:
    return FileResponse(ROOT / "static" / "gsv_p2_test.html", media_type="text/html")


@APP.head("/p2_test")
async def p2_test_head() -> HTMLResponse:
    return HTMLResponse("")


@APP.head("/tavo_test")
async def tavo_test_head() -> HTMLResponse:
    return HTMLResponse("")


@APP.get("/voices")
async def list_voices() -> dict[str, list[dict[str, Any]]]:
    voices = voice_library.list_voices()
    return {"voices": voices, "items": voices}


@APP.get("/voice_preview")
async def voice_preview(name: str) -> FileResponse:
    return _voice_preview_response(name)


@APP.head("/voice_preview")
async def voice_preview_head(name: str) -> FileResponse:
    return _voice_preview_response(name)


def _voice_preview_response(name: str) -> FileResponse:
    profile = voice_library.get_voice_profile(name)
    if not profile:
        raise HTTPException(status_code=404, detail="voice profile not found")
    audio_path = profile.get("ref_audio_path") or voice_library.get_voice_path(name)
    if not audio_path:
        raise HTTPException(status_code=404, detail="voice audio not found")
    path = Path(str(audio_path))
    if not path.is_absolute():
        path = ROOT / path
    if not path.is_file():
        raise HTTPException(status_code=404, detail="voice audio file not found")
    return FileResponse(path)


@APP.get("/profiles")
async def list_profiles() -> list[dict[str, Any]]:
    return profile_store.list_profiles()


@APP.get("/profiles/{name}")
async def get_profile(name: str) -> dict[str, Any]:
    profile = profile_store.get_profile(name)
    if profile is None:
        raise HTTPException(status_code=404, detail="profile not found")
    return profile


@APP.post("/profiles")
async def save_profile(request: ProfileSaveRequest) -> dict[str, Any]:
    row_id = profile_store.save_profile(request.name, request.data)
    return {"id": row_id, "name": request.name}


@APP.delete("/profiles/{name}")
async def delete_profile(name: str) -> dict[str, bool]:
    return {"deleted": profile_store.delete_profile(name)}


@APP.get("/usage")
async def list_usage(limit: int = 200) -> list[dict[str, Any]]:
    return profile_store.list_usage(limit=limit)


@APP.post("/usage")
async def append_usage(request: UsageLogRequest) -> dict[str, int]:
    return {"id": profile_store.append_usage(request.event_type, request.payload)}


@APP.post("/parse_text")
async def parse_text(request: ParseTextRequest) -> dict[str, Any]:
    return llm_proxy.parse_text_openai_compatible(
        text=request.text,
        endpoint=request.endpoint,
        model=request.model,
        api_key=request.api_key,
        system_prompt=request.system_prompt,
        temperature=request.temperature,
        timeout=request.timeout,
        max_tokens=request.max_tokens,
    )


@APP.get("/server_log/tail")
async def server_log_tail(since: float = 0, n: int = 50, filter: str = "") -> dict[str, Any]:
    return {"lines": [], "items": [], "since": time.time()}


@APP.get("/cache")
async def list_cache(limit: int = 200) -> list[dict[str, Any]]:
    return snapshot_cache.list_cache(limit=limit)


@APP.get("/cache_audio/{key}")
async def cache_audio(key: str) -> FileResponse:
    path = snapshot_cache.get_cached_audio(key)
    if path is None:
        raise HTTPException(status_code=404, detail="cache not found")
    return FileResponse(path, media_type="audio/wav")


@APP.head("/cache_audio/{key}")
async def cache_audio_head(key: str) -> FileResponse:
    path = snapshot_cache.get_cached_audio(key)
    if path is None:
        raise HTTPException(status_code=404, detail="cache not found")
    return FileResponse(path, media_type="audio/wav")


@APP.delete("/cache/{key}")
async def delete_cache(key: str) -> dict[str, bool]:
    return {"deleted": snapshot_cache.delete_cache(key)}


@APP.post("/tts_stream_job")
async def create_single_job(request: SingleStreamRequest) -> dict[str, Any]:
    voice_name = request.ref_audio_path.strip()
    profile = voice_library.get_voice_profile(voice_name)
    if profile is None:
        raise HTTPException(status_code=400, detail=f"voice profile not found: {voice_name}")
    payload = _single_request_to_dialogue_payload(request, voice_name)
    profiles = {"default": profile, "旁白": profile}
    cache_payload = {"kind": "gptsovits_single_v1", "request": payload, "profiles": profiles}
    cache_key = snapshot_cache.make_cache_key(cache_payload)
    cached = False if request.bypass_cache else snapshot_cache.get_cached_audio(cache_key) is not None
    if cached:
        return {
            "cache_key": cache_key,
            "cacheKey": cache_key,
            "cached": True,
            "live": False,
            "url": f"/cache_audio/{cache_key}",
            "cache_url": f"/cache_audio/{cache_key}",
            "state": "done",
        }
    try:
        result = _synthesize_dialogue_to_cache(cache_key, payload, profiles)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        "cache_key": cache_key,
        "cacheKey": cache_key,
        "cached": False,
        "live": False,
        "url": f"/cache_audio/{cache_key}",
        "cache_url": f"/cache_audio/{cache_key}",
        "state": "done",
        "segments_meta": result.get("segments_meta", []),
        "metrics": result.get("metrics", {}),
    }


@APP.delete("/cache_tts_single")
async def delete_single_cache(text: str = "", ref_audio_path: str = "") -> dict[str, bool]:
    return {"deleted": False}


@APP.post("/tts_dialogue_stream_job")
async def create_dialogue_job(request: DialogueStreamRequest) -> dict[str, Any]:
    _ensure_worker_started()
    payload = request.model_dump()
    profiles = {role: voice_library.get_voice_profile(name) for role, name in payload.get("voices", {}).items()}
    cache_payload = {"kind": "gptsovits_dialogue_v1", "request": payload, "profiles": profiles}
    cache_key = snapshot_cache.make_cache_key(cache_payload)
    cached = snapshot_cache.get_cached_audio(cache_key) is not None
    if cached:
        with JOBS_LOCK:
            JOBS[cache_key] = {"state": "done", "cached": True, "cache_key": cache_key, "segments_meta": []}
        return {
            "cache_key": cache_key,
            "cacheKey": cache_key,
            "cached": True,
            "live": False,
            "url": f"/tts_dialogue_stream_job/{cache_key}",
            "cache_url": f"/cache_audio/{cache_key}",
            "state": "done",
        }

    with JOBS_LOCK:
        existing = JOBS.get(cache_key)
        if existing and existing.get("state") in {"deferred_stream", "queued", "running"}:
            state = str(existing.get("state"))
            position = _queue_position(cache_key) if state == "queued" else 0
        else:
            prefer_live = bool(payload.get("streaming_mode"))
            state = "deferred_stream" if prefer_live else "queued"
            position = 0 if prefer_live else JOB_QUEUE.qsize() + 1
            JOBS[cache_key] = {
                "state": state,
                "cached": False,
                "cache_key": cache_key,
                "payload": payload,
                "profiles": profiles,
                "queued_at": time.time(),
                "queue_position": position,
            }
            if not prefer_live:
                JOB_QUEUE.put((cache_key, payload, profiles))

    return {
        "cache_key": cache_key,
        "cacheKey": cache_key,
        "cached": False,
        "live": False,
        "url": f"/tts_dialogue_stream_job/{cache_key}",
        "cache_url": f"/cache_audio/{cache_key}",
        "state": state,
        "queue_position": position,
    }


@APP.get("/tts_dialogue_stream_job/{cache_key}")
async def get_dialogue_job_audio(cache_key: str):
    path = snapshot_cache.get_cached_audio(cache_key)
    if path is not None:
        return FileResponse(path, media_type="audio/wav")

    with JOBS_LOCK:
        job = dict(JOBS.get(cache_key, {}))
    payload = job.get("payload")
    profiles = job.get("profiles")
    if not isinstance(payload, dict) or not isinstance(profiles, dict):
        raise HTTPException(status_code=404, detail="job not found or stream context expired")

    with JOBS_LOCK:
        current = JOBS.get(cache_key, {})
        if current.get("state") not in {"done", "deleted"}:
            JOBS[cache_key] = {**current, "state": "running", "started_at": time.time(), "queue_position": 0}

    try:
        result = _synthesize_dialogue_to_cache(cache_key, payload, profiles)
    except Exception as exc:
        with JOBS_LOCK:
            JOBS[cache_key] = {**job, "state": "failed", "error": str(exc), "finished_at": time.time()}
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    with JOBS_LOCK:
        JOBS[cache_key] = {"state": "done", "cached": True, "cache_key": cache_key, **result}
    path = snapshot_cache.get_cached_audio(cache_key)
    if path is None:
        raise HTTPException(status_code=500, detail="cache save failed")
    return FileResponse(path, media_type="audio/wav", headers={"X-GPT-SoVITS-Cache-Key": cache_key, "Cache-Control": "no-store"})


@APP.get("/tts_dialogue_job_status/{cache_key}")
async def dialogue_job_status(cache_key: str) -> dict[str, Any]:
    path = snapshot_cache.get_cached_audio(cache_key)
    with JOBS_LOCK:
        job = dict(JOBS.get(cache_key, {}))
        if job.get("state") == "queued":
            job["queue_position"] = _queue_position(cache_key)
        elif job.get("state") == "deferred_stream":
            job["queue_position"] = _enqueue_cache_job_locked(cache_key)
            job["state"] = "queued"
    metadata = snapshot_cache.get_cache_metadata(cache_key) if path else None
    state = "done" if path else job.get("state", "pending")
    return {
        "cache_key": cache_key,
        "state": state,
        "status": "cached" if path else state,
        "cached": bool(path),
        "cache_url": f"/cache_audio/{cache_key}" if path else "",
        "segments_meta": job.get("segments_meta") or (metadata or {}).get("segments_meta", []),
        "sample_rate": job.get("sample_rate") or (metadata or {}).get("sample_rate"),
        "duration_s": job.get("duration_s") or (metadata or {}).get("duration_s"),
        "metrics": job.get("metrics") or (metadata or {}).get("metrics", {}),
        "error": job.get("error", ""),
        "queue_position": job.get("queue_position", 0),
    }


@APP.delete("/tts_dialogue_stream_job/{cache_key}")
async def delete_dialogue_job(cache_key: str) -> dict[str, bool]:
    with JOBS_LOCK:
        JOBS[cache_key] = {"state": "deleted", "cached": False, "cache_key": cache_key, "deleted_at": time.time()}
    return {"deleted": snapshot_cache.delete_cache(cache_key)}


def _ensure_worker_started() -> None:
    global WORKER_STARTED
    if WORKER_STARTED:
        return
    with JOBS_LOCK:
        if WORKER_STARTED:
            return
        thread = threading.Thread(target=_job_worker_loop, name="gsv-tts-worker", daemon=True)
        thread.start()
        WORKER_STARTED = True


def _job_worker_loop() -> None:
    while True:
        cache_key, payload, profiles = JOB_QUEUE.get()
        try:
            with JOBS_LOCK:
                if JOBS.get(cache_key, {}).get("state") == "deleted":
                    continue
                JOBS[cache_key] = {
                    **JOBS.get(cache_key, {}),
                    "state": "running",
                    "cached": False,
                    "cache_key": cache_key,
                    "started_at": time.time(),
                    "queue_position": 0,
                }
            result = _synthesize_dialogue_to_cache(cache_key, payload, profiles)
        except Exception as exc:
            with JOBS_LOCK:
                JOBS[cache_key] = {
                    "state": "failed",
                    "cached": False,
                    "cache_key": cache_key,
                    "payload": payload,
                    "profiles": profiles,
                    "error": str(exc),
                    "finished_at": time.time(),
                }
        else:
            with JOBS_LOCK:
                if JOBS.get(cache_key, {}).get("state") != "deleted":
                    JOBS[cache_key] = {"state": "done", "cached": True, "cache_key": cache_key, **result}
        finally:
            JOB_QUEUE.task_done()


def _queue_position(cache_key: str) -> int:
    try:
        queued = list(JOB_QUEUE.queue)
    except Exception:
        return 0
    for index, item in enumerate(queued, start=1):
        if item and item[0] == cache_key:
            return index
    return 0


def _enqueue_cache_job(cache_key: str) -> int:
    with JOBS_LOCK:
        return _enqueue_cache_job_locked(cache_key)


def _enqueue_cache_job_locked(cache_key: str) -> int:
    job = JOBS.get(cache_key)
    if not job or job.get("state") in {"queued", "running", "done", "deleted"}:
        return _queue_position(cache_key)
    payload = job.get("payload")
    profiles = job.get("profiles")
    if not isinstance(payload, dict) or not isinstance(profiles, dict):
        return 0
    position = JOB_QUEUE.qsize() + 1
    JOBS[cache_key] = {**job, "state": "queued", "queue_position": position, "queued_at": time.time()}
    JOB_QUEUE.put((cache_key, payload, profiles))
    return position


def _single_request_to_dialogue_payload(request: SingleStreamRequest, voice_name: str) -> dict[str, Any]:
    sample_steps = request.sample_steps if request.sample_steps is not None else request.diffusion_steps
    return {
        "segments": [{"role": "旁白", "text": request.text, "style": "neutral", "style_alpha": 0.15}],
        "voices": {"default": voice_name, "旁白": voice_name},
        "top_p": request.top_p,
        "top_k": request.top_k,
        "temperature": request.temperature,
        "repetition_penalty": request.repetition_penalty,
        "speed_factor": request.speed_factor,
        "sample_steps": sample_steps,
        "batch_size": request.batch_size,
        "parallel_infer": request.parallel_infer,
        "text_split_method": request.text_split_method,
        "streaming_mode": False,
        "performance_mode": "single",
        "aux_ref_audio_paths": [],
    }


def _synthesize_dialogue_to_cache(
    cache_key: str,
    payload: dict[str, Any],
    profiles: dict[str, Optional[dict[str, Any]]],
) -> dict[str, Any]:
    segments = _normalize_segments(payload.get("segments") or [])
    if not segments:
        raise ValueError("segments is empty")

    default_profile = _pick_default_profile(payload, profiles)
    pcm_parts: list[bytes] = []
    segments_meta: list[dict[str, Any]] = []
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    sample_width: Optional[int] = None
    offset_frames = 0
    total_bytes = 0
    started = time.perf_counter()

    for index, segment in enumerate(segments):
        profile = profiles.get(segment["role"]) or default_profile
        if not profile:
            raise ValueError(f"no voice profile for role {segment['role']!r}")
        req_payload = _official_payload_for_segment(segment, profile, payload)
        audio_bytes, first_s, total_s = _post_official_tts(req_payload)
        part = _read_wav(audio_bytes)
        if sample_rate is None:
            sample_rate = part["sample_rate"]
            channels = part["channels"]
            sample_width = part["sample_width"]
        elif (sample_rate, channels, sample_width) != (part["sample_rate"], part["channels"], part["sample_width"]):
            raise ValueError("official API returned incompatible wav format across segments")

        pcm = part["pcm"]
        frame_count = part["frames"]
        duration_s = frame_count / float(sample_rate or 1)
        pcm_parts.append(pcm)
        segments_meta.append(
            {
                "index": index,
                "role": segment["role"],
                "text": segment["text"],
                "style": segment.get("style") or "neutral",
                "style_alpha": segment.get("style_alpha"),
                "aux_ref_audio_paths": req_payload.get("aux_ref_audio_paths", []),
                "start_s": offset_frames / float(sample_rate or 1),
                "start_offset_bytes": total_bytes,
                "duration_s": duration_s,
                "voice": str(profile.get("name") or ""),
                "metrics": {"first_byte_s": first_s, "total_s": total_s, "bytes": len(audio_bytes)},
            }
        )
        offset_frames += frame_count
        total_bytes += len(pcm)

    if sample_rate is None or channels is None or sample_width is None:
        raise ValueError("no audio returned")

    merged = _write_wav_bytes(b"".join(pcm_parts), sample_rate, channels, sample_width)
    duration_s = offset_frames / float(sample_rate)
    elapsed_s = time.perf_counter() - started
    metadata = {
        "kind": "gptsovits_dialogue_v1",
        "source": "official_api_v2",
        "official_url": OFFICIAL_TTS_URL,
        "sample_rate": sample_rate,
        "channels": channels,
        "sample_width": sample_width,
        "duration_s": duration_s,
        "segments_meta": segments_meta,
        "request": payload,
        "metrics": {"total_s": elapsed_s, "audio_duration_s": duration_s, "rtf": elapsed_s / duration_s if duration_s > 0 else None},
    }
    snapshot_cache.save_cached_audio(cache_key, merged, metadata)
    return {
        "segments_meta": segments_meta,
        "sample_rate": sample_rate,
        "duration_s": duration_s,
        "metrics": metadata["metrics"],
        "finished_at": time.time(),
    }


def _normalize_segments(raw_segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for item in raw_segments:
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        role = str(item.get("role") or "旁白").strip() or "旁白"
        style = str(item.get("style") or item.get("style_ref") or "neutral").strip() or "neutral"
        try:
            style_alpha = float(item.get("style_alpha")) if item.get("style_alpha") is not None else None
        except (TypeError, ValueError):
            style_alpha = None
        segment: dict[str, Any] = {"role": role, "text": text, "style": style}
        if style_alpha is not None:
            segment["style_alpha"] = style_alpha
        if item.get("emo_vec") is not None:
            segment["emo_vec"] = item.get("emo_vec")
        if item.get("emo_alpha") is not None:
            segment["emo_alpha"] = item.get("emo_alpha")
        out.append(segment)
    return out


def _pick_default_profile(payload: dict[str, Any], profiles: dict[str, Optional[dict[str, Any]]]) -> Optional[dict[str, Any]]:
    for key in ("default", "旁白", "角色", "当前角色"):
        profile = profiles.get(key)
        if profile:
            return profile
    for profile in profiles.values():
        if profile:
            return profile
    default_voice = str(payload.get("default_voice") or "local_huihui").strip()
    return voice_library.get_voice_profile(default_voice)


def _official_payload_for_segment(segment: dict[str, Any], profile: dict[str, Any], request_payload: dict[str, Any]) -> dict[str, Any]:
    defaults = dict(profile.get("default_params") or {})
    parallel_infer = request_payload.get("parallel_infer")
    segment_aux_paths = _style_aux_ref_audio_paths(segment.get("style"), segment.get("style_alpha"))
    aux_ref_audio_paths = (
        segment_aux_paths
        or request_payload.get("aux_ref_audio_paths")
        or profile.get("aux_ref_audio_paths")
        or defaults.get("aux_ref_audio_paths")
        or []
    )
    payload = {
        "text": segment["text"],
        "text_lang": profile.get("text_lang") or "zh",
        "ref_audio_path": profile.get("ref_audio_path") or "",
        "prompt_text": profile.get("prompt_text") or "",
        "prompt_lang": profile.get("prompt_lang") or "zh",
        "top_k": request_payload.get("top_k", defaults.get("top_k", 15)),
        "top_p": request_payload.get("top_p", defaults.get("top_p", 1.0)),
        "temperature": request_payload.get("temperature", defaults.get("temperature", 1.0)),
        "text_split_method": request_payload.get("text_split_method") or defaults.get("text_split_method", "cut5"),
        "batch_size": request_payload.get("batch_size") or defaults.get("batch_size", 1),
        "batch_threshold": defaults.get("batch_threshold", 0.75),
        "split_bucket": defaults.get("split_bucket", True),
        "speed_factor": request_payload.get("speed_factor", defaults.get("speed_factor", 1.0)),
        "fragment_interval": defaults.get("fragment_interval", 0.3),
        "seed": defaults.get("seed", -1),
        "media_type": "wav",
        "streaming_mode": False,
        "parallel_infer": defaults.get("parallel_infer", True) if parallel_infer is None else parallel_infer,
        "repetition_penalty": request_payload.get("repetition_penalty", defaults.get("repetition_penalty", 1.35)),
        "sample_steps": request_payload.get("sample_steps", defaults.get("sample_steps", 32)),
        "super_sampling": defaults.get("super_sampling", False),
        "overlap_length": defaults.get("overlap_length", 2),
        "min_chunk_length": defaults.get("min_chunk_length", 16),
    }
    if aux_ref_audio_paths:
        payload["aux_ref_audio_paths"] = list(aux_ref_audio_paths)
    if not payload["ref_audio_path"]:
        raise ValueError(f"voice profile {profile.get('name')!r} has no ref_audio_path")
    if not payload["prompt_text"]:
        raise ValueError(
            f"voice profile {profile.get('name')!r} has no prompt_text; "
            "GPT-SoVITS voices must be JSON profiles with ref_audio_path and exact transcript"
        )
    return payload


def _style_aux_ref_audio_paths(style: Any, style_alpha: Any = None) -> list[str]:
    style_id = str(style or "neutral").strip()
    if not style_id or style_id == "neutral":
        return []

    mapped = STYLE_ALIASES.get(style_id, style_id)
    if not mapped:
        return []

    path = _find_style_audio(mapped)
    if path is None:
        return []
    return [path.as_posix()]


def _find_style_audio(style_id: str) -> Optional[Path]:
    if not STYLE_DIR.is_dir():
        return None
    safe_style = style_id.replace("/", "").replace("\\", "").strip()
    if not safe_style or safe_style in {".", ".."}:
        return None
    for ext in (".wav", ".WAV", ".mp3", ".MP3", ".m4a", ".M4A", ".flac", ".FLAC", ".ogg", ".OGG"):
        candidate = STYLE_DIR / f"{safe_style}{ext}"
        if candidate.is_file():
            return candidate
    target = safe_style.lower()
    for candidate in STYLE_DIR.iterdir():
        if candidate.is_file() and candidate.stem.lower() == target and candidate.suffix.lower() in {".wav", ".mp3", ".m4a", ".flac", ".ogg"}:
            return candidate
    return None


def _official_payload_for_live_stream(payload: dict[str, Any], profiles: dict[str, Optional[dict[str, Any]]]) -> dict[str, Any]:
    segments = _normalize_segments(payload.get("segments") or [])
    if not segments:
        raise ValueError("segments is empty")
    default_profile = _pick_default_profile(payload, profiles)
    if not default_profile:
        raise ValueError("no default voice profile for live stream")
    text = "\n".join(segment["text"] for segment in segments)
    stream_payload = _official_payload_for_segment({"role": "live", "text": text}, default_profile, payload)
    stream_payload["streaming_mode"] = True
    stream_payload["media_type"] = "wav"
    return stream_payload


def _post_official_tts(payload: dict[str, Any]) -> tuple[bytes, float, float]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urlrequest.Request(
        OFFICIAL_TTS_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    first_at = None
    chunks: list[bytes] = []
    try:
        resp_ctx = urlrequest.urlopen(req, timeout=600)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"official API HTTP {exc.code}: {detail}") from exc
    with resp_ctx as resp:
        while True:
            chunk = resp.read(65536)
            if not chunk:
                break
            if first_at is None:
                first_at = time.perf_counter()
            chunks.append(chunk)
    ended = time.perf_counter()
    return b"".join(chunks), (first_at or ended) - started, ended - started


def _stream_official_tts(payload: dict[str, Any], on_done=None):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urlrequest.Request(
        OFFICIAL_TTS_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp_ctx = urlrequest.urlopen(req, timeout=600)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"official API HTTP {exc.code}: {detail}") from exc
    try:
        with resp_ctx as resp:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                yield chunk
    finally:
        if on_done is not None:
            on_done()


def _read_wav(audio_bytes: bytes) -> dict[str, Any]:
    with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
        return {
            "sample_rate": wav.getframerate(),
            "channels": wav.getnchannels(),
            "sample_width": wav.getsampwidth(),
            "frames": wav.getnframes(),
            "pcm": wav.readframes(wav.getnframes()),
        }


def _write_wav_bytes(pcm: bytes, sample_rate: int, channels: int, sample_width: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(sample_width)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return buf.getvalue()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(APP, host="127.0.0.1", port=9880)
