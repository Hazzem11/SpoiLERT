# SpoilERT ML classifier

Fine-tune a DistilBERT binary classifier (`spoiler` / `safe`) and export it for on-device Transformers.js inference in the Chrome extension.

## Pipeline

```bash
# 1) Create / refresh seed labels
python3 ml/scripts/augment_seed.py

# 2) Install training deps (Python 3.10+ recommended)
python3 -m venv ml/.venv
source ml/.venv/bin/activate
pip install -r ml/requirements.txt

# 3) Fine-tune
python3 ml/scripts/train_classifier.py

# 4) Export ONNX (q8) into public/models/spoiler-classifier
python3 ml/scripts/export_onnx.py
```

Then rebuild the extension (`npm run build`). The background service worker loads the model from `models/spoiler-classifier` and WASM from `wasm/`.

## Dataset

- Source: [`data/seed_spoilers.jsonl`](data/seed_spoilers.jsonl)
- Labels: `spoiler` | `safe`
- Expand templates by editing `TITLES` / templates in [`scripts/augment_seed.py`](scripts/augment_seed.py)

## Notes

- Training checkpoints live under `ml/artifacts/` (gitignored).
- Packaged inference weights: `public/models/spoiler-classifier/onnx/model_quantized.onnx` (~64MB).
- FP32 `model.onnx` is deleted after export and gitignored.
- If model files are missing at runtime, the extension falls back to the heuristic detector.
- Cloud inference is not used; classification runs on-device only.
