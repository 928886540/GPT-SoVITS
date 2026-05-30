from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from gsv_adapter import llm_proxy, profile_store, snapshot_cache, voice_library


APP = FastAPI(title="GPT-SoVITS Tavo Local Adapter")
ROOT = Path(__file__).resolve().parent


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
async def list_voices() -> list[dict[str, Any]]:
    return voice_library.list_voices()


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
    return {
        "cache_key": cache_key,
        "cacheKey": cache_key,
        "cached": cached,
        "live": False,
        "url": f"/tts_dialogue_stream_job/{cache_key}",
        "cache_url": f"/cache_audio/{cache_key}",
        "message": "GPT-SoVITS engine binding is pending; job contract is ready.",
    }


@APP.get("/tts_dialogue_stream_job/{cache_key}")
async def get_dialogue_job_audio(cache_key: str) -> FileResponse:
    return await cache_audio(cache_key)


@APP.get("/tts_dialogue_job_status/{cache_key}")
async def dialogue_job_status(cache_key: str) -> dict[str, Any]:
    path = snapshot_cache.get_cached_audio(cache_key)
    return {
        "cache_key": cache_key,
        "status": "cached" if path else "pending_engine_binding",
        "cached": bool(path),
        "segments_meta": [],
    }


@APP.delete("/tts_dialogue_stream_job/{cache_key}")
async def delete_dialogue_job(cache_key: str) -> dict[str, bool]:
    return {"deleted": snapshot_cache.delete_cache(cache_key)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(APP, host="127.0.0.1", port=9880)
