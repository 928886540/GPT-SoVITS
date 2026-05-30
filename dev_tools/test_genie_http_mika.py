import json
import ctypes
from ctypes import wintypes
import multiprocessing
import os
import time
import wave
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "Leon_api" / "models"
REPORTS_DIR = ROOT / "Leon_api" / "reports"
OUT_DIR = REPORTS_DIR / "genie_http_mika"

HOST = "127.0.0.1"
PORT = 8077
BASE_URL = f"http://{HOST}:{PORT}"
CHARACTER = "mika"
TEXT = "どうしようかな……やっぱりやりたいかも……！"
SAMPLE_RATE = 32000
CHANNELS = 1
SAMPLE_WIDTH = 2


class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
    _fields_ = [
        ("cb", wintypes.DWORD),
        ("PageFaultCount", wintypes.DWORD),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
        ("PrivateUsage", ctypes.c_size_t),
    ]


def process_memory(pid: int):
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return None
    try:
        counters = PROCESS_MEMORY_COUNTERS_EX()
        counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS_EX)
        ok = ctypes.windll.psapi.GetProcessMemoryInfo(
            handle,
            ctypes.byref(counters),
            counters.cb,
        )
        if not ok:
            return None
        mib = 1024 * 1024
        return {
            "working_set_mib": round(counters.WorkingSetSize / mib, 1),
            "peak_working_set_mib": round(counters.PeakWorkingSetSize / mib, 1),
            "private_mib": round(counters.PrivateUsage / mib, 1),
            "pagefile_mib": round(counters.PagefileUsage / mib, 1),
        }
    finally:
        ctypes.windll.kernel32.CloseHandle(handle)


def run_server():
    import genie_tts as genie

    os.chdir(MODELS_DIR)
    genie.start_server(host=HOST, port=PORT, workers=1)


def wait_until_ready(timeout_s=30.0):
    deadline = time.perf_counter() + timeout_s
    with httpx.Client(timeout=2.0) as client:
        while time.perf_counter() < deadline:
            try:
                res = client.get(f"{BASE_URL}/openapi.json")
                if res.status_code == 200:
                    return
            except Exception:
                pass
            time.sleep(0.25)
    raise RuntimeError("Genie HTTP server did not become ready in time")


def write_wav_from_raw(raw_path: Path, wav_path: Path):
    data = raw_path.read_bytes()
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(data)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    model_dir = MODELS_DIR / "CharacterModels" / "v2ProPlus" / CHARACTER / "tts_models"
    prompt_json = MODELS_DIR / "CharacterModels" / "v2ProPlus" / CHARACTER / "prompt_wav.json"
    prompt_info = json.loads(prompt_json.read_text(encoding="utf-8"))
    normal = prompt_info["Normal"]
    prompt_wav = MODELS_DIR / "CharacterModels" / "v2ProPlus" / CHARACTER / "prompt_wav" / normal["wav"]

    raw_path = OUT_DIR / "mika_http.raw"
    wav_path = OUT_DIR / "mika_http_wrapped.wav"

    server = multiprocessing.Process(target=run_server, daemon=True)
    server.start()
    try:
        mem_after_spawn = process_memory(server.pid)
        t_ready = time.perf_counter()
        wait_until_ready()
        ready_s = time.perf_counter() - t_ready
        mem_after_ready = process_memory(server.pid)

        with httpx.Client(timeout=None) as client:
            t_load = time.perf_counter()
            res = client.post(
                f"{BASE_URL}/load_character",
                json={
                    "character_name": CHARACTER,
                    "onnx_model_dir": str(model_dir),
                    "language": "Japanese",
                },
            )
            res.raise_for_status()
            load_s = time.perf_counter() - t_load
            mem_after_load = process_memory(server.pid)

            res = client.post(
                f"{BASE_URL}/set_reference_audio",
                json={
                    "character_name": CHARACTER,
                    "audio_path": str(prompt_wav),
                    "audio_text": normal["text"],
                    "language": "Japanese",
                },
            )
            res.raise_for_status()

            first_chunk_s = None
            chunk_count = 0
            byte_count = 0
            content_type = None
            mem_peak_during_stream = mem_after_load

            t_tts = time.perf_counter()
            with client.stream(
                "POST",
                f"{BASE_URL}/tts",
                json={
                    "character_name": CHARACTER,
                    "text": TEXT,
                    "split_sentence": True,
                },
            ) as res:
                res.raise_for_status()
                content_type = res.headers.get("content-type")
                with raw_path.open("wb") as raw:
                    for chunk in res.iter_bytes():
                        if chunk:
                            if first_chunk_s is None:
                                first_chunk_s = time.perf_counter() - t_tts
                            chunk_count += 1
                            byte_count += len(chunk)
                            raw.write(chunk)
                            snap = process_memory(server.pid)
                            if snap and (
                                not mem_peak_during_stream
                                or snap["peak_working_set_mib"] > mem_peak_during_stream["peak_working_set_mib"]
                            ):
                                mem_peak_during_stream = snap
            total_s = time.perf_counter() - t_tts
            mem_after_tts = process_memory(server.pid)

        write_wav_from_raw(raw_path, wav_path)

        result = {
            "ok": True,
            "engine": "genie-tts-http",
            "ready_s": round(ready_s, 3),
            "load_character_s": round(load_s, 3),
            "first_chunk_s": round(first_chunk_s, 3) if first_chunk_s is not None else None,
            "total_s": round(total_s, 3),
            "chunk_count": chunk_count,
            "stream_bytes": byte_count,
            "content_type": content_type,
            "raw_starts_with_riff": raw_path.read_bytes()[:4] == b"RIFF",
            "raw_path": str(raw_path),
            "wrapped_wav_path": str(wav_path),
            "wrapped_wav_bytes": wav_path.stat().st_size,
            "memory_after_spawn": mem_after_spawn,
            "memory_after_ready": mem_after_ready,
            "memory_after_load_character": mem_after_load,
            "memory_peak_during_stream": mem_peak_during_stream,
            "memory_after_tts": mem_after_tts,
        }
        (OUT_DIR / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        server.terminate()
        server.join(timeout=10)


if __name__ == "__main__":
    main()
