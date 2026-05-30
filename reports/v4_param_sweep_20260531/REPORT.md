# GPT-SoVITS V4 Parameter Sweep

Output directory: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531`
API base URL: `http://127.0.0.1:9881`
Profile path: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\高圆圆.json`
Reference audio: `D:/apiWorkSpace/GPT-SoVITS/Leon_api/prompts/library/女声/高圆圆.mp3`
Test text: `今晚我们继续做 GPT SoVITS V4 的本地测试。第一段请保持声音稳定，不要突然提高音量。第二段请稍微放慢一点，把语气读得自然，有一点亲近感。第三段我们会比较不同 batch size 和采样步数，对首包、总耗时、显存和最终听感的影响。最后一段请保持清晰，不要吞字，也不要把停顿拉得太长。`

## Summary

| Case | Runs | batch | steps | parallel | Avg first byte | Avg total | Avg duration | Avg RTF | Avg GPU after | PCM |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `b4_steps4_parallel` | 1 | 4 | 4 | True | 5.096s | 5.099s | 27.418s | 0.186 | 4596 MiB | 48000 Hz / 768.0 kbps |
| `b8_steps8_parallel` | 1 | 8 | 8 | True | 5.287s | 5.291s | 27.746s | 0.191 | 4598 MiB | 48000 Hz / 768.0 kbps |
| `b4_steps8_parallel` | 1 | 4 | 8 | True | 6.214s | 6.218s | 29.823s | 0.209 | 4597 MiB | 48000 Hz / 768.0 kbps |
| `b4_steps16_parallel` | 1 | 4 | 16 | True | 8.368s | 8.372s | 28.625s | 0.292 | 4596 MiB | 48000 Hz / 768.0 kbps |
| `b2_steps8_parallel` | 1 | 2 | 8 | True | 8.805s | 8.809s | 28.557s | 0.308 | 4595 MiB | 48000 Hz / 768.0 kbps |
| `b2_steps8_serial` | 1 | 2 | 8 | False | 10.673s | 10.676s | 28.440s | 0.375 | 4598 MiB | 48000 Hz / 768.0 kbps |
| `b1_steps8_parallel` | 1 | 1 | 8 | True | 13.241s | 13.245s | 29.674s | 0.446 | 4595 MiB | 48000 Hz / 768.0 kbps |
| `b1_steps16_parallel` | 1 | 1 | 16 | True | 17.040s | 17.044s | 28.680s | 0.594 | 4597 MiB | 48000 Hz / 768.0 kbps |
| `b1_steps32_parallel` | 1 | 1 | 32 | True | 26.407s | 26.410s | 27.760s | 0.951 | 4607 MiB | 48000 Hz / 768.0 kbps |

## Runs

### b1_steps32_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b1_steps32_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b1_steps32_parallel\run_1.json`
- parameters: `{'batch_size': 1, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 32, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `26.407`
- total_s: `26.410`
- audio_duration_s: `27.760`
- rtf: `0.951`
- wav_info: `{'duration_s': 27.76, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 6134, 'memory_total_mib': 12288, 'utilization_gpu_percent': 26}`
- gpu_after: `{'memory_used_mib': 4607, 'memory_total_mib': 12288, 'utilization_gpu_percent': 98}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 5663.2, 'private_mib': 12911.8, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3238.9, 'private_mib': 8099.1, 'peak_working_set_mib': 5707}`

### b1_steps16_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b1_steps16_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b1_steps16_parallel\run_1.json`
- parameters: `{'batch_size': 1, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 16, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `17.040`
- total_s: `17.044`
- audio_duration_s: `28.680`
- rtf: `0.594`
- wav_info: `{'duration_s': 28.68, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4605, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4597, 'memory_total_mib': 12288, 'utilization_gpu_percent': 98}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3238.9, 'private_mib': 8099.1, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3236.4, 'private_mib': 7889.2, 'peak_working_set_mib': 5707}`

### b1_steps8_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b1_steps8_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b1_steps8_parallel\run_1.json`
- parameters: `{'batch_size': 1, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `13.241`
- total_s: `13.245`
- audio_duration_s: `29.674`
- rtf: `0.446`
- wav_info: `{'duration_s': 29.674041666666668, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4597, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4595, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3236.4, 'private_mib': 7889.2, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3235, 'private_mib': 7914.9, 'peak_working_set_mib': 5707}`

### b2_steps8_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b2_steps8_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b2_steps8_parallel\run_1.json`
- parameters: `{'batch_size': 2, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `8.805`
- total_s: `8.809`
- audio_duration_s: `28.557`
- rtf: `0.308`
- wav_info: `{'duration_s': 28.557041666666667, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4595, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4595, 'memory_total_mib': 12288, 'utilization_gpu_percent': 97}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3235, 'private_mib': 7914.9, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3237.9, 'private_mib': 7923.1, 'peak_working_set_mib': 5707}`

### b4_steps8_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b4_steps8_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b4_steps8_parallel\run_1.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `6.214`
- total_s: `6.218`
- audio_duration_s: `29.823`
- rtf: `0.209`
- wav_info: `{'duration_s': 29.823270833333332, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4595, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4597, 'memory_total_mib': 12288, 'utilization_gpu_percent': 99}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3237.9, 'private_mib': 7923.1, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3246.2, 'private_mib': 8084.1, 'peak_working_set_mib': 5707}`

### b8_steps8_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b8_steps8_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b8_steps8_parallel\run_1.json`
- parameters: `{'batch_size': 8, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `5.287`
- total_s: `5.291`
- audio_duration_s: `27.746`
- rtf: `0.191`
- wav_info: `{'duration_s': 27.745583333333332, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4597, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4598, 'memory_total_mib': 12288, 'utilization_gpu_percent': 100}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3246.2, 'private_mib': 8084.1, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3252.7, 'private_mib': 8096.1, 'peak_working_set_mib': 5707}`

### b4_steps16_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b4_steps16_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b4_steps16_parallel\run_1.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 16, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `8.368`
- total_s: `8.372`
- audio_duration_s: `28.625`
- rtf: `0.292`
- wav_info: `{'duration_s': 28.6255, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4596, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4596, 'memory_total_mib': 12288, 'utilization_gpu_percent': 7}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3252.7, 'private_mib': 8096.1, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3250.7, 'private_mib': 8092.6, 'peak_working_set_mib': 5707}`

### b4_steps4_parallel run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b4_steps4_parallel\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b4_steps4_parallel\run_1.json`
- parameters: `{'batch_size': 4, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 4, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': True, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `5.096`
- total_s: `5.099`
- audio_duration_s: `27.418`
- rtf: `0.186`
- wav_info: `{'duration_s': 27.418333333333333, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4596, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4596, 'memory_total_mib': 12288, 'utilization_gpu_percent': 90}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3250.7, 'private_mib': 8092.6, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3253.3, 'private_mib': 8097.5, 'peak_working_set_mib': 5707}`

### b2_steps8_serial run 1

- ok: `True`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b2_steps8_serial\run_1.wav`
- JSON: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\b2_steps8_serial\run_1.json`
- parameters: `{'batch_size': 2, 'batch_threshold': 0.75, 'split_bucket': True, 'sample_steps': 8, 'top_k': 15, 'top_p': 1.0, 'temperature': 1.0, 'text_split_method': 'cut5', 'streaming_mode': False, 'parallel_infer': False, 'speed_factor': 1.0, 'fragment_interval': 0.3, 'overlap_length': 2, 'min_chunk_length': 16, 'repetition_penalty': 1.35, 'super_sampling': False}`
- first_byte_s: `10.673`
- total_s: `10.676`
- audio_duration_s: `28.440`
- rtf: `0.375`
- wav_info: `{'duration_s': 28.44, 'sample_rate_hz': 48000, 'channels': 1, 'sample_width_bytes': 2, 'bitrate_kbps_pcm': 768.0}`
- gpu_before: `{'memory_used_mib': 4596, 'memory_total_mib': 12288, 'utilization_gpu_percent': 6}`
- gpu_after: `{'memory_used_mib': 4598, 'memory_total_mib': 12288, 'utilization_gpu_percent': 98}`
- process_before: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3253.3, 'private_mib': 8097.5, 'peak_working_set_mib': 5707}`
- process_after: `{'pid': 16356, 'process_name': 'python', 'working_set_mib': 3270, 'private_mib': 7976.5, 'peak_working_set_mib': 5707}`
