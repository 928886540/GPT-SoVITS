from __future__ import annotations

import argparse
import json
import time
import wave
from pathlib import Path
from urllib import error, request


def wav_duration_s(path: Path) -> float | None:
    try:
        with wave.open(str(path), "rb") as wav:
            frames = wav.getnframes()
            rate = wav.getframerate()
            return frames / float(rate) if rate else None
    except wave.Error:
        return None


def post_json(url: str, payload: dict, out_path: Path) -> tuple[float, float, int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    start = time.perf_counter()
    first_byte_at = None
    total_bytes = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        resp_ctx = request.urlopen(req, timeout=600)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {detail}") from exc

    with resp_ctx as resp, out_path.open("wb") as fp:
        while True:
            chunk = resp.read(65536)
            if not chunk:
                break
            if first_byte_at is None:
                first_byte_at = time.perf_counter()
            total_bytes += len(chunk)
            fp.write(chunk)
    end = time.perf_counter()
    first = (first_byte_at or end) - start
    return first, end - start, total_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark official GPT-SoVITS api_v2 /tts")
    parser.add_argument("--url", default="http://127.0.0.1:9881/tts")
    parser.add_argument("--payload", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    payload_path = Path(args.payload)
    out_path = Path(args.out)
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    print("URL:", args.url)
    print("Payload:", payload_path)
    print("Output:", out_path)
    print("Parameters:")
    for key in [
        "batch_size",
        "sample_steps",
        "top_k",
        "top_p",
        "temperature",
        "text_split_method",
        "streaming_mode",
        "parallel_infer",
        "speed_factor",
        "fragment_interval",
        "overlap_length",
        "min_chunk_length",
    ]:
        print(f"  {key}: {payload.get(key)}")

    first_s, total_s, byte_count = post_json(args.url, payload, out_path)
    duration = wav_duration_s(out_path)
    rtf = total_s / duration if duration and duration > 0 else None
    print("Result:")
    print(f"  first_byte_s: {first_s:.3f}")
    print(f"  total_s: {total_s:.3f}")
    print(f"  bytes: {byte_count}")
    print(f"  audio_duration_s: {duration:.3f}" if duration else "  audio_duration_s: unknown")
    print(f"  rtf: {rtf:.3f}" if rtf else "  rtf: unknown")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
