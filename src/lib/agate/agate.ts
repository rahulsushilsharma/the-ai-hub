// @ts-nocheck
/* eslint-disable */
// Ported from Logolabs/agate-webgpu (MIT).
// Agate in the browser: tokenizer (tokenizers.js) + ONNX graphs run by onnxruntime-web (WebGPU, WASM
// fallback) + an Euler flow sampler with CFG. Mirrors agate/pipeline.py (AgatePipeline) of
// Logolabs/agate-preview-001 / -002 (fcdm_t2, 256 px) and Logolabs/agate-preview-003 (fcdm_t2mr: 512 or 256 px,
// SD3 timestep shift, prompt pipeline + count code, see prompt.js). Every image is marked (marking.js).

import * as ort from "onnxruntime-web/webgpu";
import { Tokenizer } from "@huggingface/tokenizers";
import { prepare, countVector } from "./prompt";
import { embedWatermark, marks } from "./marking";

export { ort };

// The releases this page runs. remote: where the files live -- each release's model repo, under webgpu/ (the
// Space repo has a 1 GB storage limit; the graphs there also output the thinker plan). The Space's old models/
// (001 without the plan output) is used only through ?models=. dir: the layout under a local
// models base (?models=<url> or window.AGATE_MODEL_BASE given explicitly, e.g. for local testing). cache: Cache
// Storage name (001 keeps the name it always had, so returning visitors do not download it again).
const HUB = (v) => `https://huggingface.co/Logolabs/agate-preview-${v}/resolve/main/webgpu/v2/`;   // v2: fast fp16 step graphs
export const VERSIONS = {
  "003": { remote: HUB("003"), dir: "003/", cache: "agate-preview-003-web", res: [512, 256], note: "Multi-resolution model, 512 px (or 256). Quoted text is spelled out, counts are coded, “no X” becomes a negative prompt." },
  "002": { remote: HUB("002"), dir: "002/", cache: "agate-preview-002-web", res: [256], note: "Same network as 001, trained 38,710 steps longer before the same anneal. 256 px, plain prompts." },
  "001": { remote: HUB("001"), dir: "", cache: "agate-preview-001-web", res: [256], note: "The first preview (2026-09-25). 256 px, plain prompts." },
};
const countUrl = (v) => `https://huggingface.co/Logolabs/agate-preview-${v}/resolve/main/config.json`;
const FILES_T2 = ["tokenizer.json", "tokenizer_config.json", "text_encoder.onnx", "generator.onnx", "taesd_decoder.onnx"];

export async function webgpuStatus() {
  if (!("gpu" in navigator)) return { ok: false, why: "This browser does not expose WebGPU (navigator.gpu is missing)." };
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return { ok: false, why: "WebGPU is present but no GPU adapter is available." };
    let name = "";
    try { const info = adapter.info || (await adapter.requestAdapterInfo?.()); name = [info?.vendor, info?.architecture, info?.description].filter(Boolean).join(" "); } catch { /* optional */ }
    return { ok: true, adapter: name, maxBuffer: adapter.limits?.maxBufferSize };
  } catch (e) {
    return { ok: false, why: `WebGPU adapter request failed: ${e.message || e}` };
  }
}

// ---- downloads with progress + Cache Storage ---------------------------------------------------
async function openCache(name) {
  try { return await caches.open(name); } catch { return null; }   // file://, private mode, ...
}

async function fetchCached(cacheName, url, key, expectBytes, onBytes) {
  const cache = await openCache(cacheName);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) { const buf = new Uint8Array(await hit.arrayBuffer()); onBytes(buf.byteLength, true); return { buf, cached: true }; }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  // manifest size first: a compressed response would report the encoded length
  const total = expectBytes || Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  let buf = new Uint8Array(total || 1 << 20), n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (n + value.byteLength > buf.byteLength) { const b2 = new Uint8Array(Math.max(buf.byteLength * 2, n + value.byteLength)); b2.set(buf.subarray(0, n)); buf = b2; }
    buf.set(value, n); n += value.byteLength; onBytes(value.byteLength, false);
  }
  buf = n === buf.byteLength ? buf : buf.slice(0, n);
  if (cache) {
    try { await cache.put(key, new Response(buf, { headers: { "content-type": "application/octet-stream", "content-length": String(n) } })); }
    catch (e) { console.warn("cache put failed (quota?)", e); }
  }
  return { buf, cached: false };
}

export async function hasCachedModel(version = "001") {
  try { const c = await caches.open(VERSIONS[version].cache); return (await c.keys()).length >= 5; } catch { return false; }
}

export async function clearCache() {
  let ok = true;
  for (const v of Object.values(VERSIONS)) { try { ok = (await caches.delete(v.cache)) && ok; } catch { ok = false; } }
  return ok;
}

// The Hub counts a model download only on a request for the model repo's root config.json; the ONNX files
// come from this Space, so every model load reads the loaded release's config.json once -- the same per-load
// count a Python from_pretrained() produces, cached weights or not.
function countLoad(version) { fetch(countUrl(version), { cache: "no-store" }).catch(() => {}); }

// ---- the model ---------------------------------------------------------------------------------
export class Agate {
  // base: the page's models folder (001); override: an explicit models base for every version (local layout)
  constructor({ base = "./models/", override = null, version = "003", ep = "webgpu", variant = null, optLevel = "all" } = {}) {
    this.optLevel = optLevel;
    const slash = (u) => (u.endsWith("/") ? u : u + "/");
    this.version = version;
    this.spec = VERSIONS[version];
    this.base = override ? slash(override) + this.spec.dir : (this.spec.remote || slash(base) + this.spec.dir);
    this.ep = ep;
    this.variant = variant;          // e.g. "full16": fp16-compute generator (experimental, 001 only)
    this.marks = marks(version);
  }

  get mr() { return this.manifest?.arch === "fcdm_t2mr"; }

  // the fast build (2026-09-29): one Euler step per run, fp16 compute, everything stays on the GPU between steps
  get fast() { return !!this.manifest?.step; }

  fileKey(f) { return new Request(`${this.base}${f}?sha256=${this.manifest.files[f].sha256}`); }

  async getFile(f, onBytes = () => {}) {
    const meta = this.manifest.files[f];
    return (await fetchCached(this.spec.cache, this.base + f, this.fileKey(f), meta.bytes, onBytes)).buf;
  }

  // onProgress({loaded, total, file, phase}); resolution: 003 only (512 default, or 256)
  async load(onProgress = () => {}, resolution = null) {
    const manifest = await (await fetch(this.base + "manifest.json", { cache: "no-cache" })).json();
    this.manifest = manifest;
    const swap = (this.variant && manifest.variants?.[this.variant]) || {};
    const real = (f) => swap[f] || f;
    this.resolution = this.mr ? Number(resolution || manifest.resolution) : 256;
    // 003: download everything (the two graphs are ~1 MB each and share one weights file), so a resolution
    // switch needs no network
    const need = this.mr || manifest.step ? Object.keys(manifest.files) : FILES_T2;
    const total = need.reduce((s, f) => s + manifest.files[real(f)].bytes, 0);
    let loaded = 0, fromCache = 0;
    const bufs = {};
    const t0 = performance.now();
    for (const f of need) {
      const meta = manifest.files[real(f)];
      const { buf } = await fetchCached(this.spec.cache, this.base + real(f), this.fileKey(real(f)), meta.bytes, (b, c) => {
        loaded += b; if (c) fromCache += b; onProgress({ phase: "download", file: f, loaded, total });
      });
      bufs[f] = buf;
    }
    this.stats = { downloadMB: total / 1e6, fromCacheMB: fromCache / 1e6, downloadMs: performance.now() - t0 };
    countLoad(this.version);
    // drop cached files of older builds of this release (keys carry the sha256)
    try {
      const cache = await openCache(this.spec.cache), keep = new Set(need.map((f) => new URL(this.fileKey(real(f)).url, location.href).href));
      if (cache) for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
    } catch (e) { console.warn("cache cleanup", e); }
    const dec = new TextDecoder();
    this.tok = new Tokenizer(JSON.parse(dec.decode(bufs["tokenizer.json"])), JSON.parse(dec.decode(bufs["tokenizer_config.json"])));

    if (this.ep === "wasm") {
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
    }
    const t1 = performance.now();
    this.sessions = {};
    for (const [name, f] of [["text", "text_encoder.onnx"], ["vae", "taesd_decoder.onnx"]]) {
      onProgress({ phase: "init", file: f, loaded: total, total });
      const ts = performance.now();
      this.sessions[name] = await ort.InferenceSession.create(bufs[f], this.sessionOptions());
      this.stats[`${name}SessionMs`] = performance.now() - ts;
      bufs[f] = null;
    }
    onProgress({ phase: "init", file: "generator", loaded: total, total });
    const ts = performance.now();
    if (this.fast) {
      this.weights = bufs[manifest.step.external_data];      // kept for a resolution switch (no re-read)
      await this.createGenerator(this.resolution, bufs);
    } else if (this.mr) {
      this.weights = bufs["generator.weights"];              // kept for a resolution switch (no re-read)
      await this.createGenerator(this.resolution, bufs);
    } else {
      this.sessions.gen = await ort.InferenceSession.create(bufs["generator.onnx"], this.sessionOptions());
    }
    this.stats.genSessionMs = performance.now() - ts;
    this.stats.sessionMs = performance.now() - t1;
    return this.stats;
  }

  sessionOptions(extra = {}) { return { executionProviders: [this.ep], graphOptimizationLevel: this.optLevel, ...extra }; }

  // 003: the generator graph for one resolution; the weights file is shared by both graphs.
  async createGenerator(res, bufs = {}) {
    let graphName, ext, extra = {};
    if (this.fast) {
      graphName = this.manifest.step.graphs[String(res)];
      ext = this.manifest.step.external_data;
      extra = { preferredOutputLocation: "gpu-buffer" };     // z_next / x1 / plan stay on the GPU
    } else {
      const r = this.manifest.resolutions[String(res)];
      graphName = r?.graph; ext = r?.external_data;
    }
    if (!graphName) throw new Error(`resolution ${res} not available`);
    const graph = bufs[graphName] || await this.getFile(graphName);
    const weights = this.weights || await this.getFile(ext);
    if (this.sessions.gen) { try { await this.sessions.gen.release(); } catch { /* */ } this.sessions.gen = null; }
    this.sessions.gen = await ort.InferenceSession.create(graph, this.sessionOptions({ externalData: [{ path: ext, data: weights }], ...extra }));
    this.resolution = Number(res);
  }

  async setResolution(res) {
    if (!this.mr || Number(res) === this.resolution) return 0;
    const t0 = performance.now();
    await this.createGenerator(res);
    return performance.now() - t0;
  }

  async release() {
    for (const s of Object.values(this.sessions || {})) { try { await s?.release(); } catch { /* */ } }
    this.sessions = null; this.weights = null;
  }

  tokenize(text) {
    const max = this.manifest.text_max_len;
    let ids = this.tok.encode(text).ids;                 // [CLS] ... [SEP], as the HF tokenizer
    if (ids.length > max) ids = ids.slice(0, max - 1).concat(ids[ids.length - 1]);   // truncation=True
    return ids;
  }

  async encode(text) {
    const ids = this.tokenize(text);
    const n = ids.length;
    const feeds = {
      input_ids: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, n]),
      attention_mask: new ort.Tensor("int64", new BigInt64Array(n).fill(1n), [1, n]),
    };
    const out = await this.sessions.text.run(feeds);
    const h = out.last_hidden_state;
    const data = h.data.slice();                          // (1, n, 512) fp32
    h.dispose?.();
    return { data, n, ids };
  }

  // The prompt as the model sees it: 003 runs its prompt pipeline (prompt.js), 001/002 use the prompt as typed.
  prepare(prompt, negative = "") {
    const pp = this.manifest.prompt_pipeline;
    if (!pp) return { text: prompt, negative };
    const [text, neg] = prepare(prompt, negative, pp.normalize, pp.spell);
    return { text, negative: neg };
  }

  static gaussianNoise(seed, count) {
    // mulberry32 + Box-Muller. Seeds do NOT reproduce PyTorch's torch.randn stream.
    let a = seed >>> 0;
    const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const out = new Float32Array(count);
    for (let i = 0; i < count; i += 2) {
      const u1 = Math.max(rnd(), 1e-12), u2 = rnd();
      const r = Math.sqrt(-2 * Math.log(u1));
      out[i] = r * Math.cos(2 * Math.PI * u2);
      if (i + 1 < count) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
    }
    return out;
  }

  // SD3's resolution shift in Agate's convention (t = 0 noise), as agate/pipeline.py shift_t
  static shiftT(t, shift) {
    if (shift === 1) return t;
    const s = 1 - t;
    return 1 - shift * s / (1 + (shift - 1) * s);
  }

  // -> { rgba (watermarked unless watermark=false), width, height, latent, timings, prepared }
  get hasPlan() { return !!this.sessions?.gen?.outputNames?.includes("plan"); }

  // GPU-resident sampler for the step graphs: z_next of one run is the z input of the next, ctx / mask / counts
  // are uploaded once, and nothing is read back until the end. The preview (plan + x1) is requested only when
  // onPreview is set, previewReady() says the viewer is free and no earlier readback is still in flight; its
  // download is started but never awaited by the loop (frames are dropped instead).
  async sampleFast({ z, grid, cfg, hw, C, L, D, ctx, mask, cnt, onStep, onPreview, previewReady, shouldStop, stepMs }) {
    const dev = ort.env.webgpu?.device;
    const bufs = [];
    const gpuT = (data, dims) => {
      if (!dev) return new ort.Tensor("float32", data, dims);
      const buf = dev.createBuffer({ size: Math.ceil(data.byteLength / 16) * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(buf, 0, data);
      bufs.push(buf);
      return ort.Tensor.fromGpuBuffer(buf, { dataType: "float32", dims });
    };
    const fixed = { ctx: gpuT(ctx, [2, L, D]), mask: gpuT(mask, [2, L]) };
    if (this.sessions.gen.inputNames.includes("counts")) fixed.counts = gpuT(cnt || new Float32Array(2 * L), [2, L]);
    const steps = grid.length - 1;
    let zT = new ort.Tensor("float32", z, [1, C, hw, hw]), inflight = false;
    const one = (v) => new ort.Tensor("float32", new Float32Array([v]), [1]);
    const cfgT = one(cfg);
    try {
      for (let i = 0; i < steps; i++) {
        if (shouldStop()) throw new Error("stopped");
        const ts = performance.now();
        const want = !!onPreview && this.hasPlan && !inflight && previewReady();
        const out = await this.sessions.gen.run({ z: zT, t: one(grid[i]), dt: one(grid[i + 1] - grid[i]), cfg: cfgT, ...fixed },
                                                want ? ["z_next", "x1", "plan"] : ["z_next"]);
        if (i > 0) zT.dispose?.();
        zT = out.z_next;
        if (want) {
          inflight = true;
          const step = i + 1;
          Promise.all([out.plan.getData(true), out.x1.getData(true)])
            .then(([plan, x1]) => onPreview({ step, steps, plan, x1, hw }))
            .catch((e) => console.warn("preview", e))
            .finally(() => { inflight = false; });
        }
        stepMs.push(performance.now() - ts);
        onStep(i + 1, steps, null);
        if ((i & 3) === 3) await new Promise((r) => setTimeout(r, 0));   // let the page paint now and then
      }
      const zf = await zT.getData(true);                    // the only synchronising readback
      return Float32Array.from(zf);
    } finally {
      for (const b of bufs) { try { b.destroy(); } catch { /* */ } }
    }
  }

  // onPreview({ step, steps, plan, x1, hw }) after every step, when given and the graph outputs the plan: plan =
  // the thinker output for the conditional branch (Float32Array 640 x 16 x 16), x1 = z + (1 - t) v (guided).
  async generate({ prompt, negative = "", seed = 0, steps = 50, cfg = 3.0, noise = null, watermark = true, onStep = () => {}, onPreview = null, previewReady = () => true, shouldStop = () => false }) {
    const C = this.manifest.latent_ch, D = this.manifest.ctx_dim;
    const rc = this.mr ? this.manifest.resolutions[String(this.resolution)] : { latent_hw: this.manifest.latent_hw, shift: 1 };
    const hw = rc.latent_hw, shift = Number(rc.shift || 1);
    const per = C * hw * hw;
    const T = { };
    let t0 = performance.now();
    const prep = this.prepare(prompt, negative);
    const c = await this.encode(prep.text), u = await this.encode(prep.negative);
    T.textMs = performance.now() - t0;
    const BUCKETS = this.manifest.buckets;
    const need = Math.max(c.n, u.n);
    const L = BUCKETS.find((b) => b >= need) ?? BUCKETS[BUCKETS.length - 1];
    const ctx = new Float32Array(2 * L * D), mask = new Float32Array(2 * L);
    ctx.set(c.data, 0); ctx.set(u.data, L * D);           // zero padding, as F.pad in the pipeline
    mask.fill(1, 0, c.n); mask.fill(1, L, L + u.n);
    const feeds = { ctx: new ort.Tensor("float32", ctx, [2, L, D]), mask: new ort.Tensor("float32", mask, [2, L]) };
    let countsNonzero = 0;
    if (this.mr) {                                        // count code: conditional half only
      const cnt = new Float32Array(2 * L);
      if (this.manifest.prompt_pipeline?.count_code) cnt.set(countVector(this.tok, prep.text, c.ids, Math.min(L, c.n)), 0);
      countsNonzero = cnt.reduce((s, v) => s + (v > 0), 0);
      feeds.counts = new ort.Tensor("float32", cnt, [2, L]);
    }

    let z = noise ? Float32Array.from(noise) : Agate.gaussianNoise(seed, per);
    const grid = Array.from({ length: steps + 1 }, (_, i) => Agate.shiftT(i / steps, shift));
    t0 = performance.now();
    const stepMs = [];
    if (this.fast) {
      z = await this.sampleFast({ z, grid, cfg, hw, C, L, D, ctx, mask, cnt: feeds.counts?.data, onStep, onPreview, previewReady, shouldStop, stepMs });
    } else {
    const zz = new Float32Array(2 * per), tt = new Float32Array(2);
    for (let i = 0; i < steps; i++) {
      if (shouldStop()) throw new Error("stopped");
      const ts = performance.now();
      zz.set(z, 0); zz.set(z, per);
      tt[0] = tt[1] = grid[i];
      const want = onPreview && this.hasPlan ? ["v", "plan"] : ["v"];
      const out = await this.sessions.gen.run({ z: new ort.Tensor("float32", zz, [2, C, hw, hw]), t: new ort.Tensor("float32", tt, [2]), ...feeds }, want);
      const v = out.v.data;
      const dt = grid[i + 1] - grid[i];
      const zn = new Float32Array(per);
      let x1 = null;
      if (out.plan) x1 = new Float32Array(per);
      for (let k = 0; k < per; k++) {
        const vc = v[k], vu = v[per + k], g = vu + cfg * (vc - vu);
        zn[k] = z[k] + dt * g;
        if (x1) x1[k] = z[k] + (1 - grid[i]) * g;
      }
      out.v.dispose?.();
      if (out.plan) { const plan = out.plan.data.slice(); out.plan.dispose?.(); onPreview({ step: i + 1, steps, plan, x1, hw }); }
      z = zn;
      stepMs.push(performance.now() - ts);
      onStep(i + 1, steps, z);
      await new Promise((r) => setTimeout(r, 0));          // let the progress bar paint
    }
    }
    T.samplerMs = performance.now() - t0;
    T.firstStepMs = stepMs[0];
    T.stepMs = stepMs.length > 1 ? (T.samplerMs - stepMs[0]) / (stepMs.length - 1) : stepMs[0];

    t0 = performance.now();
    const img = await this.sessions.vae.run({ latent: new ort.Tensor("float32", z, [1, C, hw, hw]) });
    const x = img.image.data, H = img.image.dims[2], W = img.image.dims[3];
    const rgba = new Uint8ClampedArray(H * W * 4);
    for (let p = 0; p < H * W; p++) {
      for (let ch = 0; ch < 3; ch++) {
        const val = Math.min(1, Math.max(-1, x[ch * H * W + p]));
        rgba[p * 4 + ch] = Math.round((val + 1) * 127.5);
      }
      rgba[p * 4 + 3] = 255;
    }
    T.decodeMs = performance.now() - t0;
    t0 = performance.now();
    if (watermark) embedWatermark(rgba, W, H, this.marks.payload);
    T.markMs = performance.now() - t0;
    T.totalMs = T.textMs + T.samplerMs + T.decodeMs + T.markMs;
    T.bucket = L;
    return { rgba, width: W, height: H, latent: z, timings: T, prepared: { ...prep, countsNonzero }, watermarked: watermark };
  }
}
