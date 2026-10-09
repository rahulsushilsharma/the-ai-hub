import { pipeline, type ProgressInfo, type RawAudio, type TextToAudioPipeline } from "@huggingface/transformers";
import { split } from "./splitter";

const MODEL_ID = "onnx-community/Supertonic-TTS-ONNX";
const VOICES_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/voices/`;

export const VOICES = { Female: "F1", Male: "M1" } as const;
export type Voice = keyof typeof VOICES;

let pipe: Promise<TextToAudioPipeline> | null = null;
const embeddings: Partial<Record<Voice, Promise<Float32Array>>> = {};

export const hasWebGPU = () => typeof navigator !== "undefined" && "gpu" in navigator;

export function loadPipeline(onProgress: (p: ProgressInfo) => void) {
  return (pipe ??= (async () => {
    const tts = (await pipeline("text-to-speech", MODEL_ID, {
      device: "webgpu",
      progress_callback: onProgress,
    })) as TextToAudioPipeline;
    // warm-up compiles the shaders so the first real chunk isn't slow
    await tts("Hello", { speaker_embeddings: new Float32Array(101 * 128), num_inference_steps: 1, speed: 1 } as never);
    return tts;
  })().catch((e) => ((pipe = null), Promise.reject(e))));
}

export function loadEmbedding(voice: Voice) {
  return (embeddings[voice] ??= fetch(`${VOICES_URL}${VOICES[voice]}.bin`)
    .then((r) => r.arrayBuffer())
    .then((b) => new Float32Array(b)));
}

/** Sentences merged into chunks of >=min chars (so short lines don't each cost a model call), hard-capped at max. */
export function chunkText(text: string, min = 100, max = 1000): string[] {
  const out: string[] = [];
  let buf = "";
  for (const s of split(text).map((l) => l.trim()).filter(Boolean)) {
    buf = buf ? `${buf} ${s}` : s;
    while (buf.length > max) {
      out.push(buf.slice(0, max));
      buf = buf.slice(max);
    }
    if (buf.length >= min) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}

export async function* streamTTS(text: string, tts: TextToAudioPipeline, speaker_embeddings: Float32Array, quality: number, speed: number) {
  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    const out = (await tts(chunks[i], { speaker_embeddings, num_inference_steps: quality, speed } as never)) as RawAudio;
    let audio = out.audio as Float32Array;
    if (i < chunks.length - 1) {
      // 0.5s pause between chunks
      audio = new Float32Array(audio.length + Math.floor(0.5 * out.sampling_rate));
      audio.set(out.audio as Float32Array);
    }
    yield { audio, sampleRate: out.sampling_rate, chars: chunks[i].length, index: i + 1, total: chunks.length };
  }
}

/** 32-bit float mono WAV. */
export function toWav(chunks: Float32Array[], sampleRate: number): Blob {
  const bytes = chunks.reduce((n, c) => n + c.length, 0) * 4;
  const h = new DataView(new ArrayBuffer(44));
  const str = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); h.setUint32(4, 36 + bytes, true); str(8, "WAVE"); str(12, "fmt ");
  h.setUint32(16, 16, true); h.setUint16(20, 3, true); h.setUint16(22, 1, true);
  h.setUint32(24, sampleRate, true); h.setUint32(28, sampleRate * 4, true);
  h.setUint16(32, 4, true); h.setUint16(34, 32, true); str(36, "data"); h.setUint32(40, bytes, true);
  return new Blob([h.buffer, ...(chunks as BlobPart[])], { type: "audio/wav" });
}
