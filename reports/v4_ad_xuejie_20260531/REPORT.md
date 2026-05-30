# GPT-SoVITS V4 Parameter Sweep

Output directory: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531`
API base URL: `http://127.0.0.1:9881`
Profile path: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\AD学姐.json`
Reference audio: `D:/apiWorkSpace/GPT-SoVITS/Leon_api/prompts/library/女声/AD学姐.wav`
Test text: `学姐，今天我们试试这条热门音色。第一句请温柔一点，不要太用力。第二句请自然地带一点停顿，让听的人感觉是在聊天。第三句请把情绪收住，清晰地读完这段测试。`

## Summary

| Case | Runs | batch | steps | parallel | Avg first byte | Avg total | Avg duration | Avg RTF | Avg GPU after | PCM |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `b8_steps8_parallel` | 3 | 8 | 8 | True | 2.480s | 2.482s | 15.273s | 0.163 | 4744 MiB | 48000 Hz / 768.0 kbps |
| `b4_steps4_parallel` | 3 | 4 | 4 | True | 2.992s | 2.994s | 15.154s | 0.198 | 4745 MiB | 48000 Hz / 768.0 kbps |
| `b4_steps16_parallel` | 3 | 4 | 16 | True | 4.882s | 4.884s | 15.700s | 0.311 | 4745 MiB | 48000 Hz / 768.0 kbps |

## Runs

### b4_steps4_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps4_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps4_parallel\run_1.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 4, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `3.188`
- total_s: `3.190`
- audio_duration_s: `14.829`
- rtf: `0.215`
- wav_info: `{'duration_s': 14.829083333333333, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 6068, 'memory_total_mib': 12288, 'utilization_gpu_percent': 44}`
- gpu_after: `{'memory_used_mib': 4750, 'memory_total_mib': 12288, 'utilization_gpu_percent': 24}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 5738.3, 'private_mib': 12958.4, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3386.7, 'private_mib': 8434.5, 'peak_working_set_mib': 5742.9}`

### b4_steps4_parallel run 2

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps4_parallel\run_2.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps4_parallel\run_2.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 4, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `2.826`
- total_s: `2.828`
- audio_duration_s: `15.796`
- rtf: `0.179`
- wav_info: `{'duration_s': 15.795625, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4750, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4743, 'memory_total_mib': 12288, 'utilization_gpu_percent': 99}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3386.7, 'private_mib': 8434.5, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3276.7, 'private_mib': 8149.3, 'peak_working_set_mib': 5742.9}`

### b4_steps4_parallel run 3

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps4_parallel\run_3.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps4_parallel\run_3.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 4, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `2.961`
- total_s: `2.964`
- audio_duration_s: `14.836`
- rtf: `0.200`
- wav_info: `{'duration_s': 14.8361875, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4743, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4743, 'memory_total_mib': 12288, 'utilization_gpu_percent': 99}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3276.7, 'private_mib': 8149.3, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3275.9, 'private_mib': 8148.5, 'peak_working_set_mib': 5742.9}`

### b8_steps8_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b8_steps8_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b8_steps8_parallel\run_1.json`
- parameters: `{'batch_size': 8, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `2.424`
- total_s: `2.426`
- audio_duration_s: `15.354`
- rtf: `0.158`
- wav_info: `{'duration_s': 15.354, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4743, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4743, 'memory_total_mib': 12288, 'utilization_gpu_percent': 86}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3275.9, 'private_mib': 8148.5, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3272.8, 'private_mib': 8219.6, 'peak_working_set_mib': 5742.9}`

### b8_steps8_parallel run 2

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b8_steps8_parallel\run_2.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b8_steps8_parallel\run_2.json`
- parameters: `{'batch_size': 8, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `2.584`
- total_s: `2.585`
- audio_duration_s: `15.713`
- rtf: `0.165`
- wav_info: `{'duration_s': 15.713458333333334, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4743, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4744, 'memory_total_mib': 12288, 'utilization_gpu_percent': 100}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3272.8, 'private_mib': 8219.6, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.3, 'private_mib': 8219.7, 'peak_working_set_mib': 5742.9}`

### b8_steps8_parallel run 3

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b8_steps8_parallel\run_3.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b8_steps8_parallel\run_3.json`
- parameters: `{'batch_size': 8, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `2.432`
- total_s: `2.435`
- audio_duration_s: `14.752`
- rtf: `0.165`
- wav_info: `{'duration_s': 14.7515, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4744, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4744, 'memory_total_mib': 12288, 'utilization_gpu_percent': 15}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.3, 'private_mib': 8219.7, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.3, 'private_mib': 8219.6, 'peak_working_set_mib': 5742.9}`

### b4_steps16_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps16_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps16_parallel\run_1.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 16, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `4.977`
- total_s: `4.979`
- audio_duration_s: `16.313`
- rtf: `0.305`
- wav_info: `{'duration_s': 16.313208333333332, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4748, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4745, 'memory_total_mib': 12288, 'utilization_gpu_percent': 60}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.3, 'private_mib': 8219.6, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.4, 'private_mib': 8133.9, 'peak_working_set_mib': 5742.9}`

### b4_steps16_parallel run 2

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps16_parallel\run_2.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps16_parallel\run_2.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 16, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `4.788`
- total_s: `4.791`
- audio_duration_s: `15.273`
- rtf: `0.314`
- wav_info: `{'duration_s': 15.27275, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4745, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4745, 'memory_total_mib': 12288, 'utilization_gpu_percent': 99}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.4, 'private_mib': 8133.9, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.5, 'private_mib': 8135.7, 'peak_working_set_mib': 5742.9}`

### b4_steps16_parallel run 3

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps16_parallel\run_3.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\b4_steps16_parallel\run_3.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 16, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `4.880`
- total_s: `4.881`
- audio_duration_s: `15.513`
- rtf: `0.315`
- wav_info: `{'duration_s': 15.512625, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4745, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4745, 'memory_total_mib': 12288, 'utilization_gpu_percent': 99}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.5, 'private_mib': 8135.7, 'peak_working_set_mib': 5742.9}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3273.8, 'private_mib': 8138.3, 'peak_working_set_mib': 5742.9}`
