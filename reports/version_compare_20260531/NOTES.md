# GPT-SoVITS Version Compare Notes

Date: 2026-05-31

## What Was Tested

Same zero-shot profile and same text were used for all runs.

- Profile: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\高圆圆.json`
- Reference audio: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\高圆圆.mp3`
- Report: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\REPORT.md`
- Raw JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\result.json`

## Important Caveats

v4 initially returned 1-second WAV files because `gsv-v4-pretrained/vocoder.pth` was missing and the running API had a half-initialized v4 vocoder state. The missing file was added:

- `D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official\GPT_SoVITS\pretrained_models\gsv-v4-pretrained\vocoder.pth`

After restarting official `api_v2.py`, v4 produced valid full-length WAV files.

The final 9-run result is valid, but v2 run 1 is a cold-ish run after switching from a v4-started process. For practical warm comparison, look at v2 run 2 and run 3 as the more useful v2 numbers.

## Summary

| Version | Runs | First byte avg | RTF avg | GPU after avg | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `v2` | 3 | `7.503s` | `0.536` | `3952 MiB` | Average is skewed by run 1 cold-ish `12.725s`. |
| `v2` warm only | 2 | `4.892s` | `0.334` | `3952 MiB` | More realistic warm number from run 2 and run 3. |
| `v2ProPlus` | 3 | `4.828s` | `0.362` | `4167 MiB` | Current best candidate if listening quality is better than v2. |
| `v4` | 3 | `11.882s` | `0.899` | `4684 MiB` | Valid now, but much slower in this test. |

## Listen Files

v2:

- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_1.wav`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_2.wav`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_3.wav`

v2ProPlus:

- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_1.wav`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_2.wav`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_3.wav`

v4:

- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_1.wav`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_2.wav`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_3.wav`

## Current Read

For this machine and this profile, v2ProPlus is the next practical branch to audition. It is close to v2 warm speed while using only about 200 MiB more observed GPU memory. v4 is valid after adding the vocoder, but it is about 2.4x slower than v2ProPlus on this short zero-shot test.
