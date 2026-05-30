from __future__ import annotations

import argparse
import json
import subprocess
import time
import wave
from pathlib import Path
from typing import Any
from urllib import error, parse, request


V4_WEIGHTS = {
    "gpt": "GPT_SoVITS/pretrained_models/s1v3.ckpt",
    "sovits": "GPT_SoVITS/pretrained_models/gsv-v4-pretrained/s2Gv4.pth",
}

PARAM_KEYS = [
    "batch_size",
    "batch_threshold",
    "split_bucket",
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
    "super_sampling",
]

DEFAULT_CASES = [
    {"label": "b1_steps32_parallel", "params": {"batch_size": 1, "sample_steps": 32, "parallel_infer": True}},
    {"label": "b1_steps16_parallel", "params": {"batch_size": 1, "sample_steps": 16, "parallel_infer": True}},
    {"label": "b1_steps8_parallel", "params": {"batch_size": 1, "sample_steps": 8, "parallel_infer": True}},
    {"label": "b2_steps8_parallel", "params": {"batch_size": 2, "sample_steps": 8, "parallel_infer": True}},
    {"label": "b4_steps8_parallel", "params": {"batch_size": 4, "sample_steps": 8, "parallel_infer": True}},
    {"label": "b8_steps8_parallel", "params": {"batch_size": 8, "sample_steps": 8, "parallel_infer": True}},
    {"label": "b4_steps16_parallel", "params": {"batch_size": 4, "sample_steps": 16, "parallel_infer": True}},
    {"label": "b4_steps4_parallel", "params": {"batch_size": 4, "sample_steps": 4, "parallel_infer": True}},
    {"label": "b2_steps8_serial", "params": {"batch_size": 2, "sample_steps": 8, "parallel_infer": False}},
]

DEFAULT_TEXT = (
    "今晚我们继续做 GPT SoVITS V4 的本地测试。第一段请保持声音稳定，不要突然提高音量。"
    "第二段请稍微放慢一点，把语气读得自然，有一点亲近感。"
    "第三段我们会比较不同 batch size 和采样步数，对首包、总耗时、显存和最终听感的影响。"
    "最后一段请保持清晰，不要吞字，也不要把停顿拉得太长。"
)


def wav_info(path: Path) -> dict[str, Any] | None:
    try:
        with wave.open(str(path), "rb") as wav:
            frames = wav.getnframes()
            rate = wav.getframerate()
            channels = wav.getnchannels()
            sample_width = wav.getsampwidth()
            duration = frames / float(rate) if rate else None
            bitrate_kbps = rate * channels * sample_width * 8 / 1000 if rate else None
            return {
                "duration_s": duration,
                "sample_rate_hz": rate,
                "channels": channels,
                "sample_width_bytes": sample_width,
                "bitrate_kbps_pcm": bitrate_kbps,
            }
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


def switch_v4(base_url: str) -> dict[str, Any]:
    timings: dict[str, Any] = {}
    for endpoint, key in [("set_gpt_weights", "gpt"), ("set_sovits_weights", "sovits")]:
        url = f"{base_url}/{endpoint}?" + parse.urlencode({"weights_path": V4_WEIGHTS[key]})
        start = time.perf_counter()
        resp = get_json(url, timeout=300)
        timings[endpoint] = {"seconds": time.perf_counter() - start, "response": resp}
        if not isinstance(resp, dict) or resp.get("message") != "success":
            raise RuntimeError(f"Failed to switch {key} for v4: {resp}")
    return timings


def build_payload(base_payload: dict[str, Any], profile: dict[str, Any], text: str, params: dict[str, Any]) -> dict[str, Any]:
    payload = dict(base_payload)
    payload.update(profile.get("default_params", {}))
    payload.update(params)
    payload["text"] = text
    payload["text_lang"] = profile.get("text_lang", "zh")
    payload["ref_audio_path"] = profile["ref_audio_path"]
    payload["prompt_text"] = profile.get("prompt_text", "")
    payload["prompt_lang"] = profile.get("prompt_lang", "zh")
    payload["streaming_mode"] = False
    payload["media_type"] = "wav"
    payload["return_fragment"] = False
    return payload


def selected_cases(names: list[str] | None) -> list[dict[str, Any]]:
    if not names:
        return DEFAULT_CASES
    by_name = {case["label"]: case for case in DEFAULT_CASES}
    missing = [name for name in names if name not in by_name]
    if missing:
        raise ValueError(f"Unknown case(s): {', '.join(missing)}")
    return [by_name[name] for name in names]


def summarize(runs: list[dict[str, Any]]) -> dict[str, Any]:
    by_case: dict[str, list[dict[str, Any]]] = {}
    for run in runs:
        if run.get("ok"):
            by_case.setdefault(run["case_label"], []).append(run)

    summary: dict[str, Any] = {}
    for label, items in by_case.items():
        def avg(key: str) -> float:
            vals = [float(i[key]) for i in items if i.get(key) is not None]
            return sum(vals) / len(vals) if vals else 0.0

        def avg_nested(parent: str, key: str) -> float:
            vals = [float(i[parent][key]) for i in items if isinstance(i.get(parent), dict) and i[parent].get(key) is not None]
            return sum(vals) / len(vals) if vals else 0.0

        first = items[0]
        summary[label] = {
            "runs": len(items),
            "avg_first_byte_s": avg("first_byte_s"),
            "avg_total_s": avg("total_s"),
            "avg_audio_duration_s": avg("audio_duration_s"),
            "avg_rtf": avg("rtf"),
            "avg_gpu_after_mib": avg_nested("gpu_after", "memory_used_mib"),
            "avg_working_set_after_mib": avg_nested("process_after", "working_set_mib"),
            "parameters": first["parameters"],
            "sample_rate_hz": first.get("wav_info", {}).get("sample_rate_hz"),
            "bitrate_kbps_pcm": first.get("wav_info", {}).get("bitrate_kbps_pcm"),
        }
    return summary


def write_markdown(report_path: Path, data: dict[str, Any]) -> None:
    lines = [
        "# GPT-SoVITS V4 Parameter Sweep",
        "",
        f"Output directory: `{data['output_dir']}`",
        f"API base URL: `{data['api_base_url']}`",
        f"Profile path: `{data['profile_path']}`",
        f"Reference audio: `{data['ref_audio_path']}`",
        f"Test text: `{data['text']}`",
        "",
        "## Summary",
        "",
        "| Case | Runs | batch | steps | parallel | Avg first byte | Avg total | Avg duration | Avg RTF | Avg GPU after | PCM |",
        "| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    sorted_items = sorted(data["summary"].items(), key=lambda item: item[1]["avg_rtf"])
    for label, summary in sorted_items:
        params = summary["parameters"]
        pcm = f"{summary.get('sample_rate_hz') or '?'} Hz / {summary.get('bitrate_kbps_pcm') or '?'} kbps"
        lines.append(
            f"| `{label}` | {summary['runs']} | {params.get('batch_size')} | {params.get('sample_steps')} | "
            f"{params.get('parallel_infer')} | {summary['avg_first_byte_s']:.3f}s | "
            f"{summary['avg_total_s']:.3f}s | {summary['avg_audio_duration_s']:.3f}s | "
            f"{summary['avg_rtf']:.3f} | {summary['avg_gpu_after_mib']:.0f} MiB | {pcm} |"
        )

    errors = [run for run in data["runs"] if not run.get("ok")]
    if errors:
        lines.extend(["", "## Errors", ""])
        for run in errors:
            lines.append(f"- `{run['case_label']}` run `{run['run_index']}`: `{run.get('error')}`")

    lines.extend(["", "## Runs", ""])
    for run in data["runs"]:
        lines.extend(
            [
                f"### {run['case_label']} run {run['run_index']}",
                "",
                f"- ok: `{run.get('ok')}`",
                f"- WAV: `{run.get('out_wav')}`",
                f"- JSON: `{run.get('out_json')}`",
                f"- parameters: `{run.get('parameters')}`",
            ]
        )
        if run.get("ok"):
            lines.extend(
                [
                    f"- first_byte_s: `{run['first_byte_s']:.3f}`",
                    f"- total_s: `{run['total_s']:.3f}`",
                    f"- audio_duration_s: `{run['audio_duration_s']:.3f}`",
                    f"- rtf: `{run['rtf']:.3f}`",
                    f"- wav_info: `{run.get('wav_info')}`",
                    f"- gpu_before: `{run.get('gpu_before')}`",
                    f"- gpu_after: `{run.get('gpu_after')}`",
                    f"- process_before: `{run.get('process_before')}`",
                    f"- process_after: `{run.get('process_after')}`",
                ]
            )
        else:
            lines.append(f"- error: `{run.get('error')}`")
        lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run GPT-SoVITS v4 parameter sweep")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:9881")
    parser.add_argument("--profile", default=r"D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\高圆圆.json")
    parser.add_argument("--base-payload", default=r"D:\apiWorkSpace\GPT-SoVITS\Leon_api\samples\official_v2_tts_payload.local.json")
    parser.add_argument("--out-dir", default=r"D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531")
    parser.add_argument("--runs-per-case", type=int, default=1)
    parser.add_argument("--cases", nargs="*", help="Run only selected default case labels")
    parser.add_argument("--text", default=DEFAULT_TEXT)
    parser.add_argument("--sleep-between", type=float, default=0.5)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    profile_path = Path(args.profile)
    base_payload_path = Path(args.base_payload)
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    base_payload = json.loads(base_payload_path.read_text(encoding="utf-8"))
    api_base = args.api_base_url.rstrip("/")
    port = parse.urlparse(api_base).port or 80

    switch_info = switch_v4(api_base)
    cases = selected_cases(args.cases)
    runs: list[dict[str, Any]] = []

    for case in cases:
        case_label = case["label"]
        case_dir = out_dir / case_label
        case_dir.mkdir(parents=True, exist_ok=True)
        payload = build_payload(base_payload, profile, args.text, case["params"])
        payload["version_label"] = "v4"
        payload["case_label"] = case_label
        (case_dir / "payload.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        for run_index in range(1, args.runs_per_case + 1):
            out_wav = case_dir / f"run_{run_index}.wav"
            out_json = case_dir / f"run_{run_index}.json"
            record: dict[str, Any] = {
                "ok": False,
                "version": "v4",
                "case_label": case_label,
                "run_index": run_index,
                "api_base_url": api_base,
                "weights": V4_WEIGHTS,
                "switch_info": switch_info,
                "parameters": {key: payload.get(key) for key in PARAM_KEYS},
                "profile_path": str(profile_path.resolve()),
                "ref_audio_path": profile["ref_audio_path"],
                "prompt_text": profile.get("prompt_text", ""),
                "text": args.text,
                "out_wav": str(out_wav.resolve()),
                "out_json": str(out_json.resolve()),
            }
            print(f"Running {case_label} #{run_index}...")
            try:
                record["gpu_before"] = nvidia_smi()
                record["process_before"] = process_memory_by_port(port)
                first_s, total_s, byte_count = post_json(f"{api_base}/tts", payload, out_wav)
                info = wav_info(out_wav)
                if not info or not info.get("duration_s"):
                    raise RuntimeError(f"Could not read valid WAV duration: {out_wav}")
                duration = float(info["duration_s"])
                record.update(
                    {
                        "ok": True,
                        "first_byte_s": first_s,
                        "total_s": total_s,
                        "bytes": byte_count,
                        "audio_duration_s": duration,
                        "rtf": total_s / duration if duration > 0 else None,
                        "wav_info": info,
                        "gpu_after": nvidia_smi(),
                        "process_after": process_memory_by_port(port),
                    }
                )
                print(
                    f"OK {case_label} #{run_index}: first={first_s:.3f}s "
                    f"total={total_s:.3f}s duration={duration:.3f}s rtf={record['rtf']:.3f}"
                )
            except Exception as exc:
                record["error"] = repr(exc)
                record["gpu_after"] = nvidia_smi()
                record["process_after"] = process_memory_by_port(port)
                print(f"ERROR {case_label} #{run_index}: {exc!r}")
            out_json.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
            runs.append(record)
            if args.sleep_between > 0:
                time.sleep(args.sleep_between)

    data = {
        "output_dir": str(out_dir.resolve()),
        "api_base_url": api_base,
        "profile_path": str(profile_path.resolve()),
        "base_payload_path": str(base_payload_path.resolve()),
        "ref_audio_path": profile["ref_audio_path"],
        "prompt_text": profile.get("prompt_text", ""),
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
