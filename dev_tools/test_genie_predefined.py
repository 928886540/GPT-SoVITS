import asyncio
import json
import os
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "Leon_api" / "models"
REPORTS_DIR = ROOT / "Leon_api" / "reports"
OUT_DIR = REPORTS_DIR / "genie_predefined_mika"

TEXT = "どうしようかな……やっぱりやりたいかも……！"
CHARACTER = "mika"


async def main():
    import genie_tts as genie

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    old_cwd = Path.cwd()
    os.chdir(MODELS_DIR)
    try:
        t0 = time.perf_counter()
        genie.load_predefined_character(CHARACTER)
        load_s = time.perf_counter() - t0

        wav_path = OUT_DIR / "mika_ja_short.wav"
        raw_path = OUT_DIR / "mika_ja_short.raw"

        first_chunk_s = None
        chunk_count = 0
        byte_count = 0

        t1 = time.perf_counter()
        with raw_path.open("wb") as raw:
            async for chunk in genie.tts_async(
                character_name=CHARACTER,
                text=TEXT,
                play=False,
                split_sentence=True,
                save_path=str(wav_path),
            ):
                if first_chunk_s is None:
                    first_chunk_s = time.perf_counter() - t1
                chunk_count += 1
                byte_count += len(chunk)
                raw.write(chunk)
        total_s = time.perf_counter() - t1
    finally:
        os.chdir(old_cwd)

    result = {
        "ok": True,
        "engine": "genie-tts",
        "character": CHARACTER,
        "text": TEXT,
        "load_s": round(load_s, 3),
        "first_chunk_s": round(first_chunk_s, 3) if first_chunk_s is not None else None,
        "total_s": round(total_s, 3),
        "chunk_count": chunk_count,
        "stream_bytes": byte_count,
        "wav_path": str(wav_path),
        "wav_bytes": wav_path.stat().st_size if wav_path.exists() else 0,
        "raw_path": str(raw_path),
        "raw_bytes": raw_path.stat().st_size if raw_path.exists() else 0,
        "genie_data_dir": os.environ.get("GENIE_DATA_DIR"),
        "hf_home": os.environ.get("HF_HOME"),
    }

    report_path = OUT_DIR / "result.json"
    report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
