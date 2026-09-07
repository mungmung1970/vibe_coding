# 모델 및 서버 실행성 조사

조사일: 2026-09-04  
모델 경로: `/NHNHOME/WORKSPACE/26mss001_H0/models`  
판정 기준: 로컬 파일의 `config.json`, README, 실제 weight 파일 크기, 현재 서버의 PCI/GPU 상태

## 결론

- 모델 디렉터리 12개가 확인되었다.
- 현재 서버에는 `PCI ID 10de:2901` NVIDIA 장치 8개가 보인다. NVIDIA 자료와 일치하는 B200 구성으로, B200 1장당 HBM3e 180GB, 8장 전체 1,440GB이다.
- 다만 현재 실행 환경에서는 `nvidia-smi`가 `couldn't communicate with the NVIDIA driver`로 실패하고, PyTorch CUDA도 `cuda=False`, device count `0`이다. 따라서 현재 시점에 실제 추론 가능한 모델은 0개로 판정한다. GPU 하드웨어가 없는 것이 아니라 드라이버/NVML 또는 컨테이너 GPU 전달 상태가 먼저 해결되어야 한다.
- 드라이버가 정상화되면 소형 모델, 33B 이하 모델, GPT-OSS-120B는 단일 B200에서 시작할 수 있다. Kimi K2.7 Code와 GLM-5.2-FP8은 여러 장이 필요하며, K-EXAONE 750B-A37B는 현재 8장 단일 노드에서 안정적 운영 대상으로 보기 어렵다.
- 별도 전용 STT 모델은 없다. Qwen2.5-Omni-7B가 음성 입력 인식과 음성 출력을 함께 지원하지만, 전용 STT 서비스가 필요하면 별도 ASR 모델을 추가해야 한다.

## 현재 서버 확인 결과

| 항목 | 확인 결과 | 판정 |
|---|---|---|
| GPU PCI 장치 | NVIDIA `10de:2901` 8개 | B200 8장으로 식별 |
| GPU 메모리 | `nvidia-smi` 실패로 런타임 조회 불가 | 제품 사양 기준 180GB × 8 = 1,440GB로 계산 |
| NVIDIA 드라이버 | `nvidia-smi`: driver와 통신 실패 | 실행 불가 |
| PyTorch | `2.10.0a0+b4e4ee81d3.nv25.12`, CUDA `False`, device count `0` | 실행 불가 |
| 시스템 RAM | 약 2.2TiB, 가용 약 2.1TiB | CPU offload 여지는 있으나 GPU 추론을 대체하지 않음 |

> B200 식별과 메모리 사양은 [NVIDIA DGX B200 사양](https://www.nvidia.com/en-us/data-center/dgx-b200/) 및 [NVIDIA HGX B200 구성 문서](https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory-h100-h200-b200/latest/components.html)를 참조했다. PCI ID가 B200과 일치한다는 것은 [NVIDIA Confidential Computing Deployment Guide](https://docs.nvidia.com/cc-deployment-guide-tdx-snp.pdf)의 DGX B200 예시와도 일치한다.

## 모델 분류 및 실행성

GPU 수는 weight 적재만 계산한 `이론 최소`와 CUDA graph, KV cache, 런타임 여유를 15% 남긴 `실행 권장 최소`를 나누었다. `ceil(weight GiB / 180)`은 단순 하한이며, 실제 context length와 동시 요청 수가 커지면 추가 GPU 메모리가 필요하다.

| 모델 | 유형 | 로컬 weight | 이론 최소 | 실행 권장 최소 | 현재 서버 판정 |
|---|---|---:|---:|---:|---|
| `BAAI--bge-m3` | 임베딩/검색 encoder, LLM 아님 | weight 없음(불완전) | 확인 불가 | 확인 불가 | 실행 불가: config만 있고 `*.bin`/`*.safetensors` 없음 |
| `BAAI--bge-reranker-v2-m3` | 다국어 reranker encoder, LLM 아님 | 2.12GiB | CPU 또는 1장 | CPU 또는 1장 | 드라이버 복구 후 실행 가능. CPU 실행도 가능 |
| `LGAI-EXAONE--EXAONE-4.5-33B` | VLM: 텍스트 + 이미지 입력 | 63.98GiB | 1장 | 1장 | 드라이버 복구 후 가능. 공식 README는 단일 H200 또는 4×A100-40GB 예시 제공 |
| `LGAI-EXAONE--K-EXAONE-2.0-750B-A37B` | MoE LLM, 750B total / 약 37B active 계열 | 1,395.79GiB | 8장 | 약 10장 | 현재 8장에서는 비권장. 공식 배포 예시는 2노드 × 8 H200 = 16장 |
| `Qwen--Qwen2.5-Omni-7B` | Omni: 텍스트·이미지·오디오·비디오 입력 + 텍스트·음성 출력 | 20.83GiB | 1장 | 1장 | 드라이버 복구 후 가능. 음성 출력 비활성화 시 GPU 메모리 약 2GB 절약 가능 |
| `Qwen--Qwen3-TTS-12Hz-0.6B-CustomVoice` | TTS: 텍스트 → 음성 | 2.32GiB(음성 tokenizer 포함) | CPU 또는 1장 | CPU 또는 1장 | 드라이버 복구 후 가능. 전용 TTS |
| `Qwen--Qwen3.6-27B` | VLM: 텍스트 + 이미지/비디오 입력 | 51.75GiB | 1장 | 1장 | 기본 추론 가능 예상. 공식 예시는 256K context에 8장 TP |
| `bottlecapai--ThinkingCap-Qwen3.6-27B` | Qwen3.6 기반 VLM fine-tune | 51.75GiB | 1장 | 1장 | 기본 추론 가능 예상. 제공 디렉터리는 BF16 base weight |
| `google--gemma-4-31B-it` | VLM: 텍스트 + 이미지 입력 | 58.25GiB | 1장 | 1장 | 드라이버 복구 후 가능 예상 |
| `moonshotai--Kimi-K2.7-Code` | 코드 특화 VLM/agent 모델: 텍스트 + 이미지/비디오 계열 | 554.30GiB | 4장 | 4장 이상 | 현재 8장에 적재 가능 예상. vLLM/SGLang/KTransformers 필요 |
| `openai--gpt-oss-120b` | MXFP4 MoE LLM, 120B total / 약 5.1B active | 60.77GiB(MXFP4 safetensors 기준) | 1장 | 1장 | 현재 8장에 적재 가능 예상. 공식 README는 80GB GPU 1장 실행을 명시 |
| `zai-org--GLM-5.2-FP8` | FP8 MoE LLM | 703.74GiB | 4장 | 5장 이상 | 현재 8장에 적재 가능 예상. context/KV cache에 따라 추가 여유 필요 |

### 중요 해석

1. **현재 실행 여부**: 위 표의 “가능 예상”은 드라이버와 런타임이 정상화되었을 때의 메모리 기반 판단이다. 현재 서버에서는 CUDA device가 0개이므로 어떤 모델도 실제 로딩 테스트를 통과했다고 볼 수 없다.
2. **K-EXAONE**: 로컬 weight 1,395.79GiB는 B200 8장의 이론 총 메모리 1,440GB에 거의 가득 찬다. weight 외에 runtime, KV cache, 통신 버퍼가 필요하므로 8장에 억지로 맞추는 것은 운영 기준이 아니다. 공식 README도 2노드 8×H200 배포 예시를 사용하며, B200에서는 `--disable-prefill-cuda-graph` 옵션이 필요하다고 안내한다.
3. **긴 context**: Qwen3.6 README의 8 GPU 명령은 모델이 8장을 반드시 필요로 한다는 뜻이 아니라 262,144-token context와 높은 serving 여유를 위한 예시다. 짧은 context·낮은 동시성은 weight 적재 기준보다 적은 GPU로 시작할 수 있다.
4. **동시 적재**: 모든 완전한 weight를 한 번에 GPU에 올리면 약 2,965.6GiB이다. 15% 여유를 가정한 B200 기준 약 20장(8-GPU 서버 약 3대)이 필요하다. 이는 모델별 단독 serving과 다른 요구사항이다.

## 서버 증설 판단

| 목적 | 필요한 구성 |
|---|---|
| bge reranker, TTS, 7B Omni | GPU 없이 CPU 가능하거나 B200 1장 |
| EXAONE 4.5, Qwen3.6, Gemma4, GPT-OSS-120B | B200 1장으로 시작. 서비스 동시성과 context에 따라 2장 이상 |
| Kimi K2.7 Code | B200 4장 이상. 현재 8장 서버 1대에서 다른 대형 모델과 GPU를 분리해 운영 |
| GLM-5.2-FP8 | B200 5장 이상 권장. 현재 8장 서버 1대에서 단독 운영 |
| K-EXAONE 750B-A37B | 최소 추정 10장, 검증된 운영 출발점은 2노드 × 8장(총 16장) |
| 모든 모델 동시 상주 | 약 20장 이상, 즉 8-GPU 서버 3대 수준. 실제 운영은 모델을 동시에 올리지 않고 서비스별 GPU pool로 분리 권장 |

## 실행 전 복구 순서

1. 호스트에서 NVIDIA 드라이버와 NVML을 복구하고 `nvidia-smi -L`이 8개 GPU를 출력하는지 확인한다.
2. 컨테이너 환경이면 NVIDIA Container Toolkit, GPU device passthrough, `/dev/nvidia*` 노출을 확인한다. 현재 컨테이너에서는 `/dev/nvidia*`가 보이지 않는다.
3. `python -c "import torch; print(torch.cuda.is_available(), torch.cuda.device_count())"`가 `True`, `8`을 반환하는지 확인한다.
4. 먼저 GPT-OSS-120B 또는 EXAONE 4.5를 짧은 context·동시성 1로 smoke test한다.
5. 이후 모델별 공식 권장 엔진(vLLM/SGLang/TensorRT-LLM/Transformers)을 맞추고, 실제 context length와 동시 요청 수를 반영해 GPU 수를 재측정한다.

## 조사 근거

- 각 모델의 1차 근거: 해당 모델 디렉터리의 `README.md`, `config.json`, `model.safetensors.index.json`
- weight 용량: 모델 디렉터리 내부 `*.safetensors`와 Qwen3-TTS의 `speech_tokenizer`를 합산한 디스크 크기
- `gpt-oss-120b`는 `original/` 원본과 변환본이 함께 있어 중복 합산하지 않고, serving에 사용하는 변환본 약 60.77GiB를 기준으로 계산
- [OpenAI gpt-oss README](https://github.com/openai/gpt-oss/blob/main/README.md)
- [Qwen2.5-Omni README](https://huggingface.co/Qwen/Qwen2.5-Omni-7B)
- [EXAONE 4.5 README](https://huggingface.co/LGAI-EXAONE/EXAONE-4.5-33B)
- [K-EXAONE 2.0 README](https://huggingface.co/LGAI-EXAONE/K-EXAONE-2.0-750B-A37B)
- [Qwen3.6 README](https://huggingface.co/Qwen/Qwen3.6-27B)
- [Kimi K2.7 Code README](https://huggingface.co/moonshotai/Kimi-K2.7-Code)
