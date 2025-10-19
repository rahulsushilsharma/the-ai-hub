import type { Model } from "@/types/types";

const CHAT_MODELS: Model[] = [
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

  {
    label: "MobileLLM-125M",
    value: "onnx-community/MobileLLM-125M",
    device: "webgpu",
    dtype: "fp32",
    type: "local",
  },
];

export { CHAT_MODELS };
