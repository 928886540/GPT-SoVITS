from __future__ import annotations

import argparse
import json
import subprocess
import time
import wave
from pathlib import Path
from typing import Any
from urllib import error, parse, request


VERSIONS = {
    "v2": {
        "gpt": "GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt",
        "sovits": "GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s2G2333k.pth",
    },
    "v2ProPlus": {
        "gpt": "GPT_SoVITS/pretrained_models/s1v3.ckpt",
        "sovits": "GPT_SoVITS/pretrained_models/v2Pro/s2Gv2ProPlus.pth",
    },
    "v4": {
        "gpt": "GPT_SoVITS/pretrained_models/s1v3.ckpt",
        "sovits": "GPT_SoVITS/pretrained_models/gsv-v4-pretrained/s2Gv4.pth",
    },
}

PARAM_KEYS = [
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
    "repetition_penalty",
]


def wav_duration_s(path: Path) -> float | None:
    try:
        with wave.open(str(path), "rb") as wav:
            frames = wav.getnframes()
            rate = wav.getframerate()
            return frames / float(rate) if rate else None
    except wave.Error:
        return None


def get_json(url: str, timeout: int = 120) -> Any:
    try:
        resp_ctx = request.urlopen(url, timeout=timeout)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {detail}") from exc

    with resp_ctx as resp:
        raw = resp.read()
        text = raw.decode("utf-8", errors="replace")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text


def post_json(url: str, payload: dict[str, Any], out_path: Path, timeout: int = 900) -> tuple[float, float, int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    start = time.perf_counter()
    first_byte_at = None
    total_bytes = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        resp_ctx = request.urlopen(req, timeout=timeout)
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


def nvidia_smi() -> dict[str, Any] | None:
    cmd = [
        "nvidia-smi",
        "--query-gpu=memory.used,memory.total,utilization.gpu",
        "--format=csv,noheader,nounits",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=20)
    except Exception:
        return None
    line = result.stdout.strip().splitlines()[0].strip()
    parts = [p.strip() for p in line.split(",")]
    if len(parts) < 3:
        return {"raw": line}
    return {
        "memory_used_mib": int(parts[0]),
        "memory_total_mib": int(parts[1]),
        "utilization_gpu_percent": int(parts[2]),
    }


def process_memory_by_port(port: int) -> dict[str, Any] | None:
    ps = rf"""
$conn = Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) {{ exit 2 }}
$p = Get-Process -Id $conn.OwningProcess
[pscustomobject]@{{
  pid = $p.Id
  process_name = $p.ProcessName
  working_set_mib = [math]::Round($p.WorkingSet64 / 1MB, 1)
  private_mib = [math]::Round($p.PrivateMemorySize64 / 1MB, 1)
  peak_working_set_mib = [math]::Round($p.PeakWorkingSet64 / 1MB, 1)
}} | ConvertTo-Json -Compress
"""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception:
        return None
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"raw": result.stdout.strip()}


def switch_weights(base_url: str, version: str) -> dict[str, Any]:
    weights = VERSIONS[version]
    timings: dict[str, Any] = {}
    for endpoint, key in [("set_gpt_weights", "gpt"), ("set_sovits_weights", "sovits")]:
        url = f"{base_url}/{endpoint}?" + parse.urlencode({"weights_path": weights[key]})
        start = time.perf_counter()
        resp = get_json(url, timeout=300)
        timings[endpoint] = {"seconds": time.perf_counter() - start, "response": resp}
        if not isinstance(resp, dict) or resp.get("message") != "success":
            raise RuntimeError(f"Failed to switch {key} for {version}: {resp}")
    return timings


def build_payload(base_payload: dict[str, Any], profile: dict[str, Any], text: str) -> dict[str, Any]:
    payload = dict(base_payload)
    payload["text"] = text
    payload["text_lang"] = profile.get("text_lang", "zh")
    payload["ref_audio_path"] = profile["ref_audio_path"]
    payload["prompt_text"] = profile.get("prompt_text", "")
    payload["prompt_lang"] = profile.get("prompt_lang", "zh")
    for key, value in profile.get("default_params", {}).items():
        payload[key] = value
    payload["streaming_mode"] = False
    payload["media_type"] = "wav"
    return payload


def write_markdown(report_path: Path, data: dict[str, Any]) -> None:
    lines = [
        "# GPT-SoVITS Version Compare 20260531",
        "",
        f"Output directory: `{data['output_dir']}`",
        f"API base URL: `{data['api_base_url']}`",
        f"Profile path: `{data['profile_path']}`",
        f"Test text: `{data['text']}`",
        "",
        "## Summary",
        "",
        "| Version | Runs | Avg first byte | Avg total | Avg duration | Avg RTF | Avg GPU after | Avg Working Set after |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for version, summary in data["summary"].items():
        lines.append(
            f"| `{version}` | {summary['runs']} | {summary['avg_first_byte_s']:.3f}s | "
            f"{summary['avg_total_s']:.3f}s | {summary['avg_audio_duration_s']:.3f}s | "
            f"{summary['avg_rtf']:.3f} | {summary['avg_gpu_after_mib']:.0f} MiB | "
            f"{summary['avg_working_set_after_mib']:.1f} MiB |"
        )
    lines.extend(["", "## Runs", ""])
    for run in data["runs"]:
        lines.extend(
            [
                f"### {run['version']} run {run['run_index']}",
                "",
                f"- WAV: `{run['out_wav']}`",
                f"- JSON: `{run['out_json']}`",
                f"- first_byte_s: `{run['first_byte_s']:.3f}`",
                f"- total_s: `{run['total_s']:.3f}`",
                f"- audio_duration_s: `{run['audio_duration_s']:.3f}`",
                f"- rtf: `{run['rtf']:.3f}`",
                f"- bytes: `{run['bytes']}`",
                f"- gpu_before: `{run.get('gpu_before')}`",
                f"- gpu_after: `{run.get('gpu_after')}`",
                f"- process_before: `{run.get('process_before')}`",
                f"- process_after: `{run.get('process_after')}`",
                "",
            ]
        )
    report_path.write_text("\n".join(lines), encoding="utf-8")


def summarize(runs: list[dict[str, Any]]) -> dict[str, Any]:
    by_version: dict[str, list[dict[str, Any]]] = {}
    for run in runs:
        by_version.setdefault(run["version"], []).append(run)

    summary: dict[str, Any] = {}
    for version, items in by_version.items():
        def avg(key: str) -> float:
            vals = [float(i[key]) for i in items if i.get(key) is not None]
            return sum(vals) / len(vals) if vals else 0.0

        def avg_nested(parent: str, key: str) -> float:
            vals = [float(i[parent][key]) for i in items if isinstance(i.get(parent), dict) and i[parent].get(key) is not None]
            return sum(vals) / len(vals) if vals else 0.0

        summary[version] = {
            "runs": len(items),
            "avg_first_byte_s": avg("first_byte_s"),
            "avg_total_s": avg("total_s"),
            "avg_audio_duration_s": avg("audio_duration_s"),
            "avg_rtf": avg("rtf"),
            "avg_gpu_after_mib": avg_nested("gpu_after", "memory_used_mib"),
            "avg_working_set_after_mib": avg_nested("process_after", "working_set_mib"),
        }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Run GPT-SoVITS v2/v2ProPlus/v4 comparison benchmark")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:9881")
    parser.add_argument("--profile", default=r"D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\高圆圆.json")
    parser.add_argument("--base-payload", default=r"D:\apiWorkSpace\GPT-SoVITS\Leon_api\samples\official_v2_tts_payload.local.json")
    parser.add_argument("--out-dir", default=r"D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--versions", nargs="+", default=["v2", "v2ProPlus", "v4"])
    parser.add_argument(
        "--text",
        default="这是 GPT SoVITS 三个模型版本的同条件测试。请保持声音稳定，自然，清晰，我们会比较首包、速度、显存和最终听感。",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    profile_path = Path(args.profile)
    base_payload_path = Path(args.base_payload)
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    base_payload = json.loads(base_payload_path.read_text(encoding="utf-8"))
    payload = build_payload(base_payload, profile, args.text)
    api_base = args.api_base_url.rstrip("/")

    runs: list[dict[str, Any]] = []
    for version in args.versions:
        if version not in VERSIONS:
            raise ValueError(f"Unknown version: {version}")
        print(f"Switching to {version}...")
        switch_info = switch_weights(api_base, version)
        version_payload = dict(payload)
        version_payload["version_label"] = version
        version_dir = out_dir / version
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "payload.json").write_text(json.dumps(version_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        for run_index in range(1, args.runs + 1):
            print(f"Running {version} #{run_index}...")
            out_wav = version_dir / f"run_{run_index}.wav"
            out_json = version_dir / f"run_{run_index}.json"
            gpu_before = nvidia_smi()
            process_before = process_memory_by_port(parse.urlparse(api_base).port or 80)
            first_s, total_s, byte_count = post_json(f"{api_base}/tts", version_payload, out_wav)
            duration = wav_duration_s(out_wav)
            if not duration:
                raise RuntimeError(f"Could not read WAV duration: {out_wav}")
            rtf = total_s / duration if duration > 0 else None
            gpu_after = nvidia_smi()
            process_after = process_memory_by_port(parse.urlparse(api_base).port or 80)
            record = {
                "version": version,
                "run_index": run_index,
                "api_base_url": api_base,
                "weights": VERSIONS[version],
                "switch_info": switch_info,
                "parameters": {key: version_payload.get(key) for key in PARAM_KEYS},
                "profile_path": str(profile_path.resolve()),
                "ref_audio_path": profile["ref_audio_path"],
                "prompt_text": profile.get("prompt_text", ""),
                "text": args.text,
                "out_wav": str(out_wav.resolve()),
                "out_json": str(out_json.resolve()),
                "first_byte_s": first_s,
                "total_s": total_s,
                "bytes": byte_count,
                "audio_duration_s": duration,
                "rtf": rtf,
                "gpu_before": gpu_before,
                "gpu_after": gpu_after,
                "process_before": process_before,
                "process_after": process_after,
            }
            out_json.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
            runs.append(record)
            print(f"OK {version} #{run_index}: first={first_s:.3f}s total={total_s:.3f}s duration={duration:.3f}s rtf={rtf:.3f}")

    data = {
        "output_dir": str(out_dir.resolve()),
        "api_base_url": api_base,
        "profile_path": str(profile_path.resolve()),
        "base_payload_path": str(base_payload_path.resolve()),
        "text": args.text,
        "runs": runs,
        "summary": summarize(runs),
    }
    (out_dir / "result.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(out_dir / "REPORT.md", data)
    print("RESULT", out_dir / "result.json")
    print("REPORT", out_dir / "REPORT.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
