from __future__ import annotations

import io
import json
import os
import time
import wave
from pathlib import Path
from typing import Any, Optional
from urllib import error, request as urlrequest

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from gsv_adapter import llm_proxy, profile_store, snapshot_cache, voice_library


APP = FastAPI(title="GPT-SoVITS Tavo Local Adapter")
ROOT = Path(__file__).resolve().parent
OFFICIAL_TTS_URL = os.getenv("GPT_SOVITS_OFFICIAL_TTS_URL", "http://127.0.0.1:9881/tts")


JOBS: dict[str, dict[str, Any]] = {}


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


@APP.head("/tavo_test")
async def tavo_test_head() -> HTMLResponse:
    return HTMLResponse("")


@APP.get("/voices")
async def list_voices() -> dict[str, list[dict[str, Any]]]:
    voices = voice_library.list_voices()
    return {"voices": voices, "items": voices}


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


@APP.post("/tts_dialogue_stream_job")
async def create_dialogue_job(request: DialogueStreamRequest) -> dict[str, Any]:
    payload = request.model_dump()
    profiles = {role: voice_library.get_voice_profile(name) for role, name in payload.get("voices", {}).items()}
    cache_payload = {"kind": "gptsovits_dialogue_v1", "request": payload, "profiles": profiles}
    cache_key = snapshot_cache.make_cache_key(cache_payload)
    cached = snapshot_cache.get_cached_audio(cache_key) is not None
    if cached:
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

    JOBS[cache_key] = {"state": "running", "cached": False, "cache_key": cache_key, "started_at": time.time()}
    try:
        result = _synthesize_dialogue_to_cache(cache_key, payload, profiles)
    except Exception as exc:
        JOBS[cache_key] = {
            "state": "failed",
            "cached": False,
            "cache_key": cache_key,
            "error": str(exc),
            "finished_at": time.time(),
        }
        raise HTTPException(status_code=502, detail=f"GPT-SoVITS synthesis failed: {exc}") from exc

    JOBS[cache_key] = {"state": "done", "cached": True, "cache_key": cache_key, **result}
    return {
        "cache_key": cache_key,
        "cacheKey": cache_key,
        "cached": False,
        "live": False,
        "url": f"/tts_dialogue_stream_job/{cache_key}",
        "cache_url": f"/cache_audio/{cache_key}",
        "state": "done",
        "metrics": result.get("metrics", {}),
    }


@APP.get("/tts_dialogue_stream_job/{cache_key}")
async def get_dialogue_job_audio(cache_key: str) -> FileResponse:
    return await cache_audio(cache_key)


@APP.get("/tts_dialogue_job_status/{cache_key}")
async def dialogue_job_status(cache_key: str) -> dict[str, Any]:
    path = snapshot_cache.get_cached_audio(cache_key)
    job = JOBS.get(cache_key, {})
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
    }


@APP.delete("/tts_dialogue_stream_job/{cache_key}")
async def delete_dialogue_job(cache_key: str) -> dict[str, bool]:
    JOBS.pop(cache_key, None)
    return {"deleted": snapshot_cache.delete_cache(cache_key)}


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


def _normalize_segments(raw_segments: list[dict[str, Any]]) -> list[dict[str, str]]:
    out = []
    for item in raw_segments:
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        role = str(item.get("role") or "旁白").strip() or "旁白"
        out.append({"role": role, "text": text})
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


def _official_payload_for_segment(segment: dict[str, str], profile: dict[str, Any], request_payload: dict[str, Any]) -> dict[str, Any]:
    defaults = dict(profile.get("default_params") or {})
    payload = {
        "text": segment["text"],
        "text_lang": profile.get("text_lang") or "zh",
        "ref_audio_path": profile.get("ref_audio_path") or "",
        "prompt_text": profile.get("prompt_text") or "",
        "prompt_lang": profile.get("prompt_lang") or "zh",
        "top_k": request_payload.get("top_k", defaults.get("top_k", 15)),
        "top_p": request_payload.get("top_p", defaults.get("top_p", 1.0)),
        "temperature": request_payload.get("temperature", defaults.get("temperature", 1.0)),
        "text_split_method": defaults.get("text_split_method", "cut5"),
        "batch_size": defaults.get("batch_size", 1),
        "batch_threshold": defaults.get("batch_threshold", 0.75),
        "split_bucket": defaults.get("split_bucket", True),
        "speed_factor": request_payload.get("speed_factor", defaults.get("speed_factor", 1.0)),
        "fragment_interval": defaults.get("fragment_interval", 0.3),
        "seed": defaults.get("seed", -1),
        "media_type": "wav",
        "streaming_mode": False,
        "parallel_infer": defaults.get("parallel_infer", True),
        "repetition_penalty": request_payload.get("repetition_penalty", defaults.get("repetition_penalty", 1.35)),
        "sample_steps": request_payload.get("sample_steps", defaults.get("sample_steps", 32)),
        "super_sampling": defaults.get("super_sampling", False),
        "overlap_length": defaults.get("overlap_length", 2),
        "min_chunk_length": defaults.get("min_chunk_length", 16),
    }
    if not payload["ref_audio_path"]:
        raise ValueError(f"voice profile {profile.get('name')!r} has no ref_audio_path")
    if not payload["prompt_text"]:
        raise ValueError(f"voice profile {profile.get('name')!r} has no prompt_text")
    return payload


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
