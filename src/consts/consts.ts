import type { Model } from "@/types/types";
// first model is the default
const CHAT_MODELS: Model[] = [
  {
    label: "LFM2.5-350M",
    value: "onnx-community/LFM2.5-350M-ONNX",
    device: "webgpu",
    dtype: "q4f16",
    type: "local",
  },
  {
    label: "Qwen3.5-0.8B",
    value: "onnx-community/Qwen3.5-0.8B-Text-ONNX",
    device: "webgpu",
    dtype: "q4f16",
    type: "local",
  },
  {
    label: "Qwen3-0.6B",
    value: "onnx-community/Qwen3-0.6B-ONNX",
    device: "webgpu",
    dtype: "q4f16",
    type: "local",
  },
  {
    label: "SmolLM2-135M-Instruct",
    value: "onnx-community/SmolLM2-135M-Instruct-ONNX-GQA",
    device: "webgpu",
    type: "local",
    dtype: undefined,
  },

  {
    label: "gemma-3-270m-it",
    value: "onnx-community/gemma-3-270m-it-ONNX",
    device: "webgpu",
    dtype: "fp32",
    type: "local",
  },
];

export { CHAT_MODELS };
