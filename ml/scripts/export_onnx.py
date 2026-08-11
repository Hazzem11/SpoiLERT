#!/usr/bin/env python3
"""Export the fine-tuned classifier to a Transformers.js-compatible ONNX layout."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from optimum.onnxruntime import ORTModelForSequenceClassification, ORTQuantizer
from optimum.onnxruntime.configuration import AutoQuantizationConfig
from transformers import AutoTokenizer


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "artifacts" / "spoiler-classifier",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[2]
        / "public"
        / "models"
        / "spoiler-classifier",
    )
    args = parser.parse_args()

    if not args.checkpoint.exists():
        raise SystemExit(f"Checkpoint not found: {args.checkpoint}. Run train_classifier.py first.")

    args.output.mkdir(parents=True, exist_ok=True)
    onnx_dir = args.output / "onnx"
    onnx_dir.mkdir(parents=True, exist_ok=True)

    print(f"Exporting ONNX from {args.checkpoint} ...")
    ort_model = ORTModelForSequenceClassification.from_pretrained(
        args.checkpoint,
        export=True,
    )
    tmp_export = args.output / "_tmp_fp32"
    if tmp_export.exists():
        shutil.rmtree(tmp_export)
    ort_model.save_pretrained(tmp_export)
    tokenizer = AutoTokenizer.from_pretrained(args.checkpoint)
    tokenizer.save_pretrained(args.output)

    # Copy tokenizer + config into extension model root; quantized weights into onnx/.
    for name in ("config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt"):
        src = tmp_export / name if (tmp_export / name).exists() else args.checkpoint / name
        if src.exists():
            shutil.copy2(src, args.output / name)

    # Ensure id2label mapping is present for Transformers.js.
    config_path = args.output / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["id2label"] = {"0": "safe", "1": "spoiler"}
    config["label2id"] = {"safe": 0, "spoiler": 1}
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    quantizer = ORTQuantizer.from_pretrained(tmp_export)
    qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)
    quantizer.quantize(save_dir=onnx_dir, quantization_config=qconfig)

    # Transformers.js looks for onnx/model_quantized.onnx (q8) by default for dtype q8.
    candidates = list(onnx_dir.glob("*.onnx"))
    if not candidates:
        raise SystemExit("Quantization produced no ONNX files.")

    preferred = None
    for candidate in candidates:
        if "quantized" in candidate.name or "q8" in candidate.name or "int8" in candidate.name:
            preferred = candidate
            break
    if preferred is None:
        preferred = candidates[0]

    target = onnx_dir / "model_quantized.onnx"
    if preferred.resolve() != target.resolve():
        shutil.copy2(preferred, target)

    # Keep package small: do not ship FP32 weights with the extension.
    for fp32_name in ("model.onnx",):
        fp32_path = onnx_dir / fp32_name
        if fp32_path.exists() and fp32_path.resolve() != target.resolve():
            fp32_path.unlink()

    shutil.rmtree(tmp_export, ignore_errors=True)

    # Marker used by the extension status UI / cache busting.
    (args.output / "spoilert-model.json").write_text(
        json.dumps({"version": "1.0.0", "task": "text-classification", "dtype": "q8"}, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(f"Exported Transformers.js model to {args.output}")


if __name__ == "__main__":
    main()
