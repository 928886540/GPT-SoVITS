# GPT-SoVITS Version Compare 20260531

Output directory: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531`
API base URL: `http://127.0.0.1:9881`
Profile path: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\高圆圆.json`
Test text: `这是 GPT SoVITS 三个模型版本的同条件测试。请保持声音稳定，自然，清晰，我们会比较首包、速度、显存和最终听感。`

## Summary

| Version | Runs | Avg first byte | Avg total | Avg duration | Avg RTF | Avg GPU after | Avg Working Set after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `v2` | 3 | 7.503s | 7.504s | 14.300s | 0.536 | 3952 MiB | 3277.4 MiB |
| `v2ProPlus` | 3 | 4.828s | 4.829s | 13.340s | 0.362 | 4167 MiB | 3521.2 MiB |
| `v4` | 3 | 11.882s | 11.884s | 13.211s | 0.899 | 4684 MiB | 3258.6 MiB |

## Runs

### v2 run 1

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_1.json`
- first_byte_s: `12.725`
- total_s: `12.726`
- audio_duration_s: `13.540`
- rtf: `0.940`
- bytes: `866604`
- gpu_before: `{'memory_used_mib': 3543, 'memory_total_mib': 12288, 'utilization_gpu_percent': 19}`
- gpu_after: `{'memory_used_mib': 3952, 'memory_total_mib': 12288, 'utilization_gpu_percent': 3}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 1709.3, 'private_mib': 5222.5, 'peak_working_set_mib': 4668.1}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3267.2, 'private_mib': 7563.3, 'peak_working_set_mib': 4668.1}`

### v2 run 2

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_2.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_2.json`
- first_byte_s: `4.934`
- total_s: `4.935`
- audio_duration_s: `15.380`
- rtf: `0.321`
- bytes: `984364`
- gpu_before: `{'memory_used_mib': 3952, 'memory_total_mib': 12288, 'utilization_gpu_percent': 3}`
- gpu_after: `{'memory_used_mib': 3956, 'memory_total_mib': 12288, 'utilization_gpu_percent': 36}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3267.2, 'private_mib': 7563.3, 'peak_working_set_mib': 4668.1}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3279.2, 'private_mib': 7372.8, 'peak_working_set_mib': 4668.1}`

### v2 run 3

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_3.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2\run_3.json`
- first_byte_s: `4.850`
- total_s: `4.851`
- audio_duration_s: `13.980`
- rtf: `0.347`
- bytes: `894764`
- gpu_before: `{'memory_used_mib': 3956, 'memory_total_mib': 12288, 'utilization_gpu_percent': 4}`
- gpu_after: `{'memory_used_mib': 3947, 'memory_total_mib': 12288, 'utilization_gpu_percent': 23}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3279.2, 'private_mib': 7372.8, 'peak_working_set_mib': 4668.1}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3285.7, 'private_mib': 7367.9, 'peak_working_set_mib': 4668.1}`

### v2ProPlus run 1

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_1.json`
- first_byte_s: `5.124`
- total_s: `5.125`
- audio_duration_s: `13.180`
- rtf: `0.389`
- bytes: `843564`
- gpu_before: `{'memory_used_mib': 4332, 'memory_total_mib': 12288, 'utilization_gpu_percent': 33}`
- gpu_after: `{'memory_used_mib': 4292, 'memory_total_mib': 12288, 'utilization_gpu_percent': 21}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 4030.4, 'private_mib': 8482.7, 'peak_working_set_mib': 4668.1}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 4034.6, 'private_mib': 8510, 'peak_working_set_mib': 4668.1}`

### v2ProPlus run 2

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_2.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_2.json`
- first_byte_s: `4.951`
- total_s: `4.953`
- audio_duration_s: `13.660`
- rtf: `0.363`
- bytes: `874284`
- gpu_before: `{'memory_used_mib': 4286, 'memory_total_mib': 12288, 'utilization_gpu_percent': 4}`
- gpu_after: `{'memory_used_mib': 4151, 'memory_total_mib': 12288, 'utilization_gpu_percent': 23}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 4034.6, 'private_mib': 8510, 'peak_working_set_mib': 4668.1}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3266.9, 'private_mib': 7533.5, 'peak_working_set_mib': 4668.1}`

### v2ProPlus run 3

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_3.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v2ProPlus\run_3.json`
- first_byte_s: `4.409`
- total_s: `4.410`
- audio_duration_s: `13.180`
- rtf: `0.335`
- bytes: `843564`
- gpu_before: `{'memory_used_mib': 4066, 'memory_total_mib': 12288, 'utilization_gpu_percent': 3}`
- gpu_after: `{'memory_used_mib': 4058, 'memory_total_mib': 12288, 'utilization_gpu_percent': 29}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3266.9, 'private_mib': 7533.5, 'peak_working_set_mib': 4668.1}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3262.2, 'private_mib': 7455.2, 'peak_working_set_mib': 4668.1}`

### v4 run 1

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_1.json`
- first_byte_s: `12.917`
- total_s: `12.919`
- audio_duration_s: `13.435`
- rtf: `0.962`
- bytes: `1289820`
- gpu_before: `{'memory_used_mib': 5552, 'memory_total_mib': 12288, 'utilization_gpu_percent': 26}`
- gpu_after: `{'memory_used_mib': 4686, 'memory_total_mib': 12288, 'utilization_gpu_percent': 98}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 5687.9, 'private_mib': 12401.5, 'peak_working_set_mib': 5692.6}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3312.1, 'private_mib': 8241.3, 'peak_working_set_mib': 5692.6}`

### v4 run 2

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_2.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_2.json`
- first_byte_s: `12.111`
- total_s: `12.113`
- audio_duration_s: `13.837`
- rtf: `0.875`
- bytes: `1328428`
- gpu_before: `{'memory_used_mib': 4686, 'memory_total_mib': 12288, 'utilization_gpu_percent': 4}`
- gpu_after: `{'memory_used_mib': 4684, 'memory_total_mib': 12288, 'utilization_gpu_percent': 4}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3312.1, 'private_mib': 8241.3, 'peak_working_set_mib': 5692.6}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3231.5, 'private_mib': 7970, 'peak_working_set_mib': 5692.6}`

### v4 run 3

- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_3.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\v4\run_3.json`
- first_byte_s: `10.617`
- total_s: `10.619`
- audio_duration_s: `12.360`
- rtf: `0.859`
- bytes: `1186604`
- gpu_before: `{'memory_used_mib': 4683, 'memory_total_mib': 12288, 'utilization_gpu_percent': 4}`
- gpu_after: `{'memory_used_mib': 4683, 'memory_total_mib': 12288, 'utilization_gpu_percent': 94}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3231.5, 'private_mib': 7970, 'peak_working_set_mib': 5692.6}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3232.2, 'private_mib': 7906.9, 'peak_working_set_mib': 5692.6}`
