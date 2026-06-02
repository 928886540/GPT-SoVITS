from __future__ import annotations

import io
import json
import os
import queue
import threading
import time
import wave
import audioop
from http.client import IncompleteRead, RemoteDisconnected
from pathlib import Path
from typing import Any, Optional
from urllib import error, request as urlrequest

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response, StreamingResponse
from pydantic import BaseModel, Field, ValidationError

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
LLM_ENDPOINT = os.getenv("GSV_TAVO_LLM_ENDPOINT", "").strip()
LLM_MODEL = os.getenv("GSV_TAVO_LLM_MODEL", "").strip()
LLM_API_KEY = os.getenv("GSV_TAVO_LLM_API_KEY", "").strip()


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
MIN_REF_AUDIO_S = 3.0
MAX_REF_AUDIO_S = 10.0


class ProfileSaveRequest(BaseModel):
    name: str
    data: dict[str, Any]


class UsageLogRequest(BaseModel):
    event_type: str
    payload: dict[str, Any]


class ParseTextRequest(BaseModel):
    text: str
    endpoint: Optional[str] = None
    model: Optional[str] = None
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
    bypass_cache: bool = False
    request_id: str = ""


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
    request_id: str = ""


async def _parse_request_model(http_request: Request, model_type: type[BaseModel]) -> BaseModel:
    content_type = (http_request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    try:
        if content_type in {"", "application/json"}:
            data = await http_request.json()
        else:
            raw = (await http_request.body()).decode("utf-8-sig").strip()
            data = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"invalid JSON body: {exc}") from exc
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"invalid request body encoding: {exc}") from exc
    try:
        return model_type.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


@APP.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "engine": "gptsovits-adapter"}


@APP.get("/llm_config")
async def llm_config() -> dict[str, Any]:
    return {
        "endpoint": LLM_ENDPOINT,
        "model": LLM_MODEL,
        "api_key_configured": bool(LLM_API_KEY),
        "source": "env-default" if (LLM_ENDPOINT or LLM_MODEL or LLM_API_KEY) else "request",
        "request_overrides_env": True,
    }


@APP.get("/static/tavo.js")
async def tavo_js() -> FileResponse:
    return FileResponse(ROOT / "static" / "tavo.js", media_type="application/javascript", headers={"Cache-Control": "no-store, max-age=0"})


@APP.head("/static/tavo.js")
async def tavo_js_head() -> FileResponse:
    return FileResponse(ROOT / "static" / "tavo.js", media_type="application/javascript", headers={"Cache-Control": "no-store, max-age=0"})


def _safe_static_path(name: str, suffixes: set[str]) -> Path:
    raw_name = str(name or "").replace("\\", "/").strip()
    parts = raw_name.split("/")
    if (
        not raw_name
        or raw_name.startswith("/")
        or ":" in raw_name
        or any(part in {"", ".."} for part in parts)
    ):
        raise HTTPException(status_code=404, detail="Not Found")
    suffix = Path(raw_name).suffix.lower()
    if suffix not in suffixes:
        raise HTTPException(status_code=404, detail="Not Found")
    static_root = (ROOT / "static").resolve()
    path = (static_root / Path(*parts)).resolve()
    if static_root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Not Found")
    return path


def _static_file_response(name: str) -> Response:
    raw_name = str(name or "").replace("\\", "/").strip()
    media_types = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
    }
    suffix = Path(raw_name).suffix.lower()
    media_type = media_types.get(suffix)
    if not media_type:
        raise HTTPException(status_code=404, detail="Not Found")
    path = _safe_static_path(raw_name, set(media_types.keys()))
    headers = {"Cache-Control": "no-store, max-age=0"} if suffix in {".js", ".css", ".html", ".json"} else None
    return FileResponse(path, media_type=media_type, headers=headers)


@APP.get("/static/{name:path}")
async def static_file(name: str) -> Response:
    return _static_file_response(name)


@APP.head("/static/{name:path}")
async def static_file_head(name: str) -> Response:
    return _static_file_response(name)


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
async def parse_text(http_request: Request) -> dict[str, Any]:
    request = await _parse_request_model(http_request, ParseTextRequest)
    endpoint = (request.endpoint or "").strip() or LLM_ENDPOINT
    model = (request.model or "").strip() or LLM_MODEL
    api_key = (request.api_key or "").strip() or LLM_API_KEY
    if not endpoint:
        raise HTTPException(status_code=400, detail="LLM endpoint is not configured. Set GSV_TAVO_LLM_ENDPOINT on the adapter or fill LLM endpoint in Tavo.")
    if not model:
        raise HTTPException(status_code=400, detail="LLM model is not configured. Set GSV_TAVO_LLM_MODEL on the adapter or fill LLM model in Tavo.")
    try:
        return llm_proxy.parse_text_openai_compatible(
            text=request.text,
            endpoint=endpoint,
            model=model,
            api_key=api_key or None,
            system_prompt=request.system_prompt,
            temperature=request.temperature,
            timeout=request.timeout,
            max_tokens=request.max_tokens,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM parse failed: {exc}") from exc


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
async def create_single_job(http_request: Request) -> dict[str, Any]:
    request = await _parse_request_model(http_request, SingleStreamRequest)
    voice_name = request.ref_audio_path.strip()
    profile = voice_library.get_voice_profile(voice_name)
    if profile is None:
        raise HTTPException(status_code=400, detail=f"voice profile not found: {voice_name}")
    payload = _single_request_to_dialogue_payload(request, voice_name)
    if request.bypass_cache:
        payload["request_id"] = _bypass_cache_request_id(request.request_id)
    profiles = {"default": profile, "旁白": profile}
    try:
        _validate_payload_voice_profiles(payload, profiles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
async def create_dialogue_job(http_request: Request) -> dict[str, Any]:
    request = await _parse_request_model(http_request, DialogueStreamRequest)
    _ensure_worker_started()
    payload = request.model_dump(exclude={"bypass_cache", "request_id"})
    if request.bypass_cache:
        payload["request_id"] = _bypass_cache_request_id(request.request_id)
    profiles = {role: voice_library.get_voice_profile(name) for role, name in payload.get("voices", {}).items()}
    try:
        _validate_payload_voice_profiles(payload, profiles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    cache_payload = {"kind": "gptsovits_dialogue_v1", "request": payload, "profiles": profiles}
    cache_key = snapshot_cache.make_cache_key(cache_payload)
    cached = False if request.bypass_cache else snapshot_cache.get_cached_audio(cache_key) is not None
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
        "live": bool(payload.get("streaming_mode")),
        "url": f"/tts_dialogue_stream_job/{cache_key}",
        "cache_url": f"/cache_audio/{cache_key}",
        "state": state,
        "queue_position": position,
    }


@APP.head("/tts_dialogue_stream_job/{cache_key}")
async def get_dialogue_job_audio_head(cache_key: str):
    path = snapshot_cache.get_cached_audio(cache_key)
    headers = {"X-GPT-SoVITS-Cache-Key": cache_key, "Cache-Control": "no-store"}
    if path is not None:
        return FileResponse(path, media_type="audio/wav", headers=headers)

    with JOBS_LOCK:
        job = dict(JOBS.get(cache_key, {}))
    if job.get("state") in {"deferred_stream", "queued", "running"}:
        return Response(status_code=202, headers=headers)
    raise HTTPException(status_code=404, detail="job not found or stream context expired")


@APP.get("/tts_dialogue_stream_job/{cache_key}")
async def get_dialogue_job_audio(cache_key: str):
    path = snapshot_cache.get_cached_audio(cache_key)
    if path is not None:
        return FileResponse(
            path,
            media_type="audio/wav",
            headers={"X-GPT-SoVITS-Cache-Key": cache_key, "Cache-Control": "no-store"},
        )

    with JOBS_LOCK:
        job = dict(JOBS.get(cache_key, {}))
    payload = job.get("payload")
    profiles = job.get("profiles")
    if not isinstance(payload, dict) or not isinstance(profiles, dict):
        raise HTTPException(status_code=404, detail="job not found or stream context expired")

    if job.get("state") == "deferred_stream":
        return StreamingResponse(
            _stream_dialogue_to_cache(cache_key, payload, profiles),
            media_type="audio/wav",
            headers={"X-GPT-SoVITS-Cache-Key": cache_key, "Cache-Control": "no-store"},
        )

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
            job["queue_position"] = 0
    metadata = snapshot_cache.get_cache_metadata(cache_key) if path else None
    if path:
        state = "done"
    else:
        job_state = str(job.get("state") or "").strip()
        if job_state in {"queued", "deferred_stream", "running", "failed"}:
            state = job_state
        else:
            state = "missing"
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
        "error": job.get("error", "") or ("" if path or job else "cache not found or job expired"),
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


def _bypass_cache_request_id(value: Any) -> str:
    token = str(value or "").strip()
    if not token:
        token = f"server-{time.time_ns()}"
    token = "".join(ch for ch in token if ch.isprintable()).strip()
    return (token or f"server-{time.time_ns()}")[:160]


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


def _profile_post_gain_db(profile: dict[str, Any]) -> float:
    raw = profile.get("post_gain_db")
    if raw is None and isinstance(profile.get("default_params"), dict):
        raw = profile["default_params"].get("post_gain_db")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return 0.0
    return max(-12.0, min(12.0, value))


def _apply_pcm_gain(pcm: bytes, sample_width: int, gain_db: float) -> bytes:
    if not pcm or not gain_db:
        return pcm
    factor = 10 ** (gain_db / 20.0)
    return audioop.mul(pcm, sample_width, factor)


def _validate_payload_voice_profiles(
    payload: dict[str, Any],
    profiles: dict[str, Optional[dict[str, Any]]],
) -> None:
    segments = _normalize_segments(payload.get("segments") or [])
    if not segments:
        raise ValueError("segments is empty")
    checked: set[str] = set()
    for segment in segments:
        profile = _profile_for_segment(payload, profiles, segment)
        name = str(profile.get("name") or profile.get("ref_audio_path") or "").strip()
        if name in checked:
            continue
        _validate_voice_profile_ready(profile)
        checked.add(name)


def _validate_voice_profile_ready(profile: dict[str, Any]) -> None:
    name = str(profile.get("name") or "").strip() or "(unnamed)"
    ref_audio_path = str(profile.get("ref_audio_path") or "").strip()
    prompt_text = str(profile.get("prompt_text") or "").strip()
    if not ref_audio_path:
        raise ValueError(f"音色 {name!r} 缺少 ref_audio_path")
    if not prompt_text:
        raise ValueError(f"音色 {name!r} 缺少 prompt_text；GPT-SoVITS 音色必须有参考音频逐字稿")
    path = Path(ref_audio_path)
    if not path.is_absolute():
        path = ROOT / path
    if not path.is_file():
        raise ValueError(f"音色 {name!r} 的参考音频不存在: {path.as_posix()}")
    duration_s = _audio_duration_seconds(path)
    if duration_s is None:
        return
    if duration_s < MIN_REF_AUDIO_S or duration_s > MAX_REF_AUDIO_S:
        raise ValueError(
            f"音色 {name!r} 的参考音频时长 {duration_s:.2f}s，不在 GPT-SoVITS 要求的 "
            f"{MIN_REF_AUDIO_S:.0f}-{MAX_REF_AUDIO_S:.0f}s 范围内；请更换或裁剪 ref_audio_path: {path.as_posix()}"
        )


def _audio_duration_seconds(path: Path) -> Optional[float]:
    suffix = path.suffix.lower()
    if suffix == ".wav":
        try:
            with wave.open(str(path), "rb") as wav:
                rate = wav.getframerate()
                frames = wav.getnframes()
            return frames / float(rate) if rate else None
        except (wave.Error, OSError, EOFError):
            return None
    if suffix == ".mp3":
        return _mp3_duration_seconds(path)
    return None


def _mp3_duration_seconds(path: Path) -> Optional[float]:
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if not data:
        return None
    pos = 0
    if len(data) >= 10 and data[:3] == b"ID3":
        size = (
            ((data[6] & 0x7F) << 21)
            | ((data[7] & 0x7F) << 14)
            | ((data[8] & 0x7F) << 7)
            | (data[9] & 0x7F)
        )
        pos = 10 + size
    bitrates = {
        (3, 3): [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
        (3, 2): [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
        (3, 1): [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
        (2, 3): [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
        (2, 2): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
        (2, 1): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
        (0, 3): [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
        (0, 2): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
        (0, 1): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    }
    sample_rates = {
        3: [44100, 48000, 32000],
        2: [22050, 24000, 16000],
        0: [11025, 12000, 8000],
    }
    frames = 0
    duration = 0.0
    while pos + 4 <= len(data):
        if data[pos] != 0xFF or (data[pos + 1] & 0xE0) != 0xE0:
            pos += 1
            continue
        header = int.from_bytes(data[pos : pos + 4], "big")
        version = (header >> 19) & 0x03
        layer = (header >> 17) & 0x03
        bitrate_idx = (header >> 12) & 0x0F
        sample_idx = (header >> 10) & 0x03
        padding = (header >> 9) & 0x01
        if version == 1 or layer == 0 or bitrate_idx in {0, 15} or sample_idx == 3:
            pos += 1
            continue
        bitrate_kbps = bitrates.get((version, layer), [])[bitrate_idx]
        sample_rate = sample_rates.get(version, [])[sample_idx]
        if not bitrate_kbps or not sample_rate:
            pos += 1
            continue
        if layer == 3:
            frame_size = int(((12 * bitrate_kbps * 1000) / sample_rate + padding) * 4)
            samples = 384
        else:
            coeff = 144 if (version == 3 or layer == 2) else 72
            frame_size = int((coeff * bitrate_kbps * 1000) / sample_rate + padding)
            samples = 1152 if (version == 3 or layer == 2) else 576
        if frame_size <= 0:
            pos += 1
            continue
        duration += samples / float(sample_rate)
        frames += 1
        pos += frame_size
    return duration if frames else None


def _synthesize_dialogue_to_cache(
    cache_key: str,
    payload: dict[str, Any],
    profiles: dict[str, Optional[dict[str, Any]]],
) -> dict[str, Any]:
    segments = _normalize_segments(payload.get("segments") or [])
    if not segments:
        raise ValueError("segments is empty")
    _validate_payload_voice_profiles(payload, profiles)

    pcm_parts: list[bytes] = []
    segments_meta: list[dict[str, Any]] = []
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    sample_width: Optional[int] = None
    offset_frames = 0
    total_bytes = 0
    started = time.perf_counter()

    for index, segment in enumerate(segments):
        profile = _profile_for_segment(payload, profiles, segment)
        req_payload = _official_payload_for_segment(segment, profile, payload)
        _log_official_segment_request("cache", index, segment, profile, req_payload)
        audio_bytes, first_s, total_s = _post_official_tts(req_payload)
        part = _read_wav(audio_bytes)
        if sample_rate is None:
            sample_rate = part["sample_rate"]
            channels = part["channels"]
            sample_width = part["sample_width"]
        elif (sample_rate, channels, sample_width) != (part["sample_rate"], part["channels"], part["sample_width"]):
            raise ValueError("official API returned incompatible wav format across segments")

        gain_db = _profile_post_gain_db(profile)
        pcm = _apply_pcm_gain(part["pcm"], part["sample_width"], gain_db)
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
                "post_gain_db": gain_db,
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


def _stream_dialogue_to_cache(
    cache_key: str,
    payload: dict[str, Any],
    profiles: dict[str, Optional[dict[str, Any]]],
):
    segments = _normalize_segments(payload.get("segments") or [])
    if not segments:
        raise ValueError("segments is empty")
    _validate_payload_voice_profiles(payload, profiles)

    pcm_parts: list[bytes] = []
    segments_meta: list[dict[str, Any]] = []
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    sample_width: Optional[int] = None
    offset_frames = 0
    total_bytes = 0
    started = time.perf_counter()

    with JOBS_LOCK:
        current = JOBS.get(cache_key, {})
        JOBS[cache_key] = {**current, "state": "running", "started_at": time.time(), "queue_position": 0}

    def fail_stream(exc: Exception, segment_index: Optional[int] = None, segment: Optional[dict[str, Any]] = None) -> None:
        role = str((segment or {}).get("role") or "").strip()
        text = str((segment or {}).get("text") or "").strip()
        error_text = str(exc)
        if segment_index is not None:
            error_text = f"segment {segment_index} role={role or '?'} failed: {error_text}"
        print(
            "[gsv_adapter] dialogue_stream_failed "
            + json.dumps(
                {
                    "cache_key": cache_key,
                    "segment_index": segment_index,
                    "role": role,
                    "text_preview": text[:80],
                    "error": error_text,
                },
                ensure_ascii=True,
                separators=(",", ":"),
            ),
            flush=True,
        )
        with JOBS_LOCK:
            JOBS[cache_key] = {
                **JOBS.get(cache_key, {}),
                "state": "failed",
                "error": error_text,
                "segments_meta": segments_meta,
                "sample_rate": sample_rate,
                "duration_s": offset_frames / float(sample_rate) if sample_rate else None,
                "metrics": {
                    "partial": bool(total_bytes),
                    "partial_bytes": total_bytes,
                    "elapsed_s": time.perf_counter() - started,
                },
                "finished_at": time.time(),
            }

    try:
        for index, segment in enumerate(segments):
            profile = _profile_for_segment(payload, profiles, segment)
            req_payload = _official_payload_for_segment(segment, profile, payload)
            req_payload["streaming_mode"] = payload.get("streaming_mode") or 2
            req_payload["media_type"] = "wav"
            _log_official_segment_request("live", index, segment, profile, req_payload)

            segment_started = time.perf_counter()
            first_s: Optional[float] = None
            header_buf = b""
            saw_header = False
            segment_pcm_bytes = 0
            gain_db = _profile_post_gain_db(profile)
            gain_tail = b""

            def apply_segment_gain(data: bytes, width: int) -> bytes:
                nonlocal gain_tail
                if not data or not gain_db:
                    return data
                data = gain_tail + data
                usable = len(data) - (len(data) % width)
                gain_tail = data[usable:]
                if usable <= 0:
                    return b""
                return _apply_pcm_gain(data[:usable], width, gain_db)

            try:
                for chunk in _stream_official_tts(req_payload):
                    if first_s is None:
                        first_s = time.perf_counter() - segment_started
                    if not saw_header:
                        header_buf += chunk
                        if len(header_buf) < 44:
                            continue
                        header = header_buf[:44]
                        rest = header_buf[44:]
                        info = _wav_header_info(header)
                        if sample_rate is None:
                            sample_rate = info["sample_rate"]
                            channels = info["channels"]
                            sample_width = info["sample_width"]
                            yield header
                        elif (sample_rate, channels, sample_width) != (info["sample_rate"], info["channels"], info["sample_width"]):
                            raise ValueError("official API returned incompatible wav format across streamed segments")
                        if rest:
                            rest = apply_segment_gain(rest, info["sample_width"])
                            pcm_parts.append(rest)
                            segment_pcm_bytes += len(rest)
                            total_bytes += len(rest)
                            if rest:
                                yield rest
                        saw_header = True
                    else:
                        chunk = apply_segment_gain(chunk, sample_width or 2)
                        pcm_parts.append(chunk)
                        segment_pcm_bytes += len(chunk)
                        total_bytes += len(chunk)
                        if chunk:
                            yield chunk
            except Exception as exc:
                fail_stream(exc, index, segment)
                return

            if sample_rate is None or channels is None or sample_width is None:
                raise ValueError("official API returned no streamable wav audio")
            frame_count = segment_pcm_bytes // (channels * sample_width)
            duration_s = frame_count / float(sample_rate)
            total_s = time.perf_counter() - segment_started
            segments_meta.append(
                {
                    "index": index,
                    "role": segment["role"],
                    "text": segment["text"],
                    "style": segment.get("style") or "neutral",
                    "style_alpha": segment.get("style_alpha"),
                    "aux_ref_audio_paths": req_payload.get("aux_ref_audio_paths", []),
                    "start_s": offset_frames / float(sample_rate),
                    "start_offset_bytes": total_bytes - segment_pcm_bytes,
                    "duration_s": duration_s,
                    "voice": str(profile.get("name") or ""),
                    "post_gain_db": gain_db,
                    "metrics": {"first_byte_s": first_s, "total_s": total_s, "bytes": segment_pcm_bytes},
                }
            )
            offset_frames += frame_count

        if sample_rate is None or channels is None or sample_width is None:
            raise ValueError("no audio returned")
        merged = _write_wav_bytes(b"".join(pcm_parts), sample_rate, channels, sample_width)
        duration_s = offset_frames / float(sample_rate)
        elapsed_s = time.perf_counter() - started
        metadata = {
            "kind": "gptsovits_dialogue_v1",
            "source": "official_api_v2_stream",
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
        result = {
            "segments_meta": segments_meta,
            "sample_rate": sample_rate,
            "duration_s": duration_s,
            "metrics": metadata["metrics"],
            "finished_at": time.time(),
        }
        with JOBS_LOCK:
            if JOBS.get(cache_key, {}).get("state") != "deleted":
                JOBS[cache_key] = {"state": "done", "cached": True, "cache_key": cache_key, **result}
    except Exception as exc:
        fail_stream(exc)
        return


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


def _profile_for_segment(
    payload: dict[str, Any],
    profiles: dict[str, Optional[dict[str, Any]]],
    segment: dict[str, Any],
) -> dict[str, Any]:
    role = str(segment.get("role") or "旁白").strip() or "旁白"
    profile = profiles.get(role)
    if profile:
        return profile
    if role in {"default", "角色", "当前角色"}:
        profile = _pick_default_profile(payload, profiles)
        if profile:
            return profile
    configured = "、".join(sorted(k for k, v in profiles.items() if v)) or "(none)"
    raise ValueError(f"no voice profile for role {role!r}; configured roles: {configured}")


def _official_payload_for_segment(segment: dict[str, Any], profile: dict[str, Any], request_payload: dict[str, Any]) -> dict[str, Any]:
    defaults = dict(profile.get("default_params") or {})
    parallel_infer = request_payload.get("parallel_infer")

    def request_or_default(key: str, default: Any) -> Any:
        value = request_payload.get(key)
        return default if value is None else value

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
        "top_k": request_or_default("top_k", defaults.get("top_k", 15)),
        "top_p": request_or_default("top_p", defaults.get("top_p", 1.0)),
        "temperature": request_or_default("temperature", defaults.get("temperature", 1.0)),
        "text_split_method": request_payload.get("text_split_method") or defaults.get("text_split_method", "cut5"),
        "batch_size": request_or_default("batch_size", defaults.get("batch_size", 1)),
        "batch_threshold": defaults.get("batch_threshold", 0.75),
        "split_bucket": defaults.get("split_bucket", True),
        "speed_factor": request_or_default("speed_factor", defaults.get("speed_factor", 1.0)),
        "fragment_interval": defaults.get("fragment_interval", 0.3),
        "seed": defaults.get("seed", -1),
        "media_type": "wav",
        "streaming_mode": False,
        "parallel_infer": defaults.get("parallel_infer", True) if parallel_infer is None else parallel_infer,
        "repetition_penalty": request_or_default("repetition_penalty", defaults.get("repetition_penalty", 1.35)),
        "sample_steps": request_or_default("sample_steps", defaults.get("sample_steps", 32)),
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


def _log_official_segment_request(kind: str, index: int, segment: dict[str, Any], profile: dict[str, Any], payload: dict[str, Any]) -> None:
    text = str(segment.get("text") or "").replace("\n", " ")[:120]
    prompt_text = str(payload.get("prompt_text") or "").replace("\n", " ")[:80]
    record = {
        "kind": kind,
        "idx": index,
        "role": segment.get("role"),
        "style": segment.get("style"),
        "voice": profile.get("name"),
        "streaming_mode": payload.get("streaming_mode"),
        "sample_steps": payload.get("sample_steps"),
        "batch_size": payload.get("batch_size"),
        "ref_audio_path": payload.get("ref_audio_path"),
        "prompt_text": prompt_text,
        "text": text,
    }
    print("[gsv_adapter] official_tts " + json.dumps(record, ensure_ascii=True, separators=(",", ":")), flush=True)


def _wav_header_info(header: bytes) -> dict[str, int]:
    if len(header) < 44 or header[:4] != b"RIFF" or header[8:12] != b"WAVE":
        preview = header[:80].decode("utf-8", errors="replace")
        raise ValueError(f"official API did not return a WAV stream: {preview}")
    bits_per_sample = int.from_bytes(header[34:36], "little") or 16
    return {
        "channels": int.from_bytes(header[22:24], "little") or 1,
        "sample_rate": int.from_bytes(header[24:28], "little") or 32000,
        "sample_width": max(1, bits_per_sample // 8),
    }


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
    except error.URLError as exc:
        raise RuntimeError(f"official API connection failed: {getattr(exc, 'reason', exc)}") from exc
    bytes_read = 0
    chunks_read = 0
    try:
        with resp_ctx as resp:
            while True:
                try:
                    chunk = resp.read(65536)
                except IncompleteRead as exc:
                    partial = getattr(exc, "partial", b"") or b""
                    if partial:
                        bytes_read += len(partial)
                        chunks_read += 1
                        yield partial
                    raise RuntimeError(
                        f"official API stream incomplete after {bytes_read} bytes/{chunks_read} chunks: {exc}"
                    ) from exc
                except (RemoteDisconnected, TimeoutError, ConnectionError, OSError) as exc:
                    raise RuntimeError(
                        f"official API stream connection interrupted after {bytes_read} bytes/{chunks_read} chunks: {exc}"
                    ) from exc
                if not chunk:
                    break
                bytes_read += len(chunk)
                chunks_read += 1
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

