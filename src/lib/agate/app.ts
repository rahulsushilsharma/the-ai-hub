// @ts-nocheck
/* eslint-disable */
// Ported from Logolabs/agate-webgpu js/app.js (MIT); runs against the markup in markup.ts.
import { Agate, VERSIONS, webgpuStatus, clearCache, hasCachedModel } from "./agate";
import { addPngText } from "./marking";
import { ThinkerView } from "./thinker";

export default function init(root) {
// Model location: 001 from window.AGATE_MODEL_BASE (js/config.js, default ./models/), 002 / 003 from their model
// repos (agate.js VERSIONS); ?models=<url> serves every version from one local-layout base instead.
const params = new URLSearchParams(location.search);
const BASE = window.AGATE_MODEL_BASE || "./models/";   // 001's files (002 / 003 come from their model repos)
const MODELS_OVERRIDE = params.get("models");           // every version from <url>/{,002/,003/} (local testing)
const FORCE_EP = params.get("ep");            // "wasm" forces the CPU path
const VARIANT = params.get("variant");      // "full16": experimental fp16-compute generator (001)

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
const DEFAULT_VERSION = "003";
let version = [params.get("v"), store.get("agate-version"), DEFAULT_VERSION].find((v) => v && VERSIONS[v]);
let resolution = Number(params.get("res") || store.get("agate-res-003") || 512);
if (!VERSIONS["003"].res.includes(resolution)) resolution = 512;

const EXAMPLES = {
  common: [
    "a green teapot and a red cup on a table",
    "a minimalist logo of a fox head, orange, flat design, white background",
    "a dog sitting to the left of a cat",
    "a red cube on top of a blue sphere",
  ],
  "003": [
    'a shop sign that says "OPEN", three red apples, no people',
    "a portrait of an old fisherman at golden hour, detailed",
    'a coffee cup with the text "Good Morning" on it',
  ],
};

const $ = (id) => root.querySelector("#" + id);
const ui = {
  prompt: $("prompt"), negative: $("negative"), seed: $("seed"), steps: $("steps"), cfg: $("cfg"), go: $("go"), dice: $("dice"),
  fill: $("bar-fill"), status: $("status"), statusR: $("status-r"), canvas: $("canvas"), frame: $("frame"),
  placeholder: $("placeholder"), timings: $("timings"), save: $("save"), crisp: $("crisp"), backend: $("backend"),
  versions: $("versions"), res: $("res"), resRow: $("res-row"), prepared: $("prepared"), aiNote: $("ai-note"),
  showThinker: $("show-thinker"), thinker: $("thinker"), thinkerStep: $("thinker-step"),
};
const thinkerView = new ThinkerView($("plan-canvas"), $("pred-canvas"));
ui.showThinker.checked = store.get("agate-thinker") !== "0";
ui.showThinker.onchange = () => { store.set("agate-thinker", ui.showThinker.checked ? "1" : "0"); if (!ui.showThinker.checked) ui.thinker.hidden = true; };

let disposed = false;   // StrictMode mounts twice: the discarded run must not start a load
let agate = null, ep = FORCE_EP || "webgpu", busy = false, stop = false, gpuOk = true, last = null;
window.__agate = { state: "idle", version };           // read by the automated browser test

const res = () => (version === "003" ? resolution : 256);

function renderExamples() {
  const box = $("examples");
  box.querySelectorAll(".chip").forEach((c) => c.remove());
  for (const p of [...(EXAMPLES[version] || []), ...EXAMPLES.common].slice(0, 6)) {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = p; b.type = "button";
    b.onclick = () => { ui.prompt.value = p; };
    box.appendChild(b);
  }
}

function seg(el, items, current, onPick) {
  const hadFocus = el.contains(document.activeElement);
  el.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(it.value === current));
    b.dataset.value = it.value;
    b.innerHTML = `${it.label}${it.sub ? `<small>${it.sub}</small>` : ""}`;
    b.tabIndex = it.value === current ? 0 : -1;
    b.onclick = () => { if (!busy && it.value !== current) onPick(it.value); };
    el.appendChild(b);
  }
  if (hadFocus) el.querySelector("[tabindex='0']")?.focus();
  el.onkeydown = (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    const bs = [...el.querySelectorAll("button")], i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault(); bs[(i + d + bs.length) % bs.length].focus();
    if (!busy) bs[(i + d + bs.length) % bs.length].click();
  };
}

function renderVersion() {
  const spec = VERSIONS[version];
  seg(ui.versions, Object.keys(VERSIONS).map((v) => ({ value: v, label: `Preview ${v}`, sub: `${Math.max(...VERSIONS[v].res)} px${v === DEFAULT_VERSION ? " · newest" : ""}` })),
    version, pickVersion);
  $("ver-note").textContent = spec.note;
  $("mast-version").textContent = `Preview ${version}`;
  $("mast-spec").textContent = `0.26B · text-to-image · ${spec.res.join(" / ")} px`;
  $("ai-model").textContent = `Agate Preview ${version}`;
  $("neg-hint").textContent = version === "003" ? "(optional; “no X” in the prompt is added automatically)" : "(optional negative prompt)";
  ui.resRow.hidden = spec.res.length < 2;
  if (spec.res.length > 1) seg(ui.res, spec.res.map((r) => ({ value: r, label: `${r} × ${r}`, sub: r === 512 ? "native" : "faster" })), resolution, pickRes);
  $("out-label").textContent = `Output · ${res()} × ${res()}`;
  renderExamples();
  document.title = `Agate Preview ${version} — in your browser`;
}

async function pickVersion(v) {
  version = v; store.set("agate-version", v);
  window.__agate.version = v;
  if (agate) { await agate.release(); agate = null; }
  clearOutput();
  renderVersion();
  if (!gpuOk && !FORCE_EP) return;
  ui.go.textContent = "Load model"; ui.go.disabled = false;
  setProgress(0, "Idle", "");
  if (await hasCachedModel(v)) await load();
}

async function pickRes(r) {
  resolution = r; store.set("agate-res-003", String(r));
  renderVersion();
  if (agate?.sessions && agate.mr) {
    busy = true; ui.go.disabled = true;
    setProgress(1, `Preparing the ${r} px generator`, "");
    try { const ms = await agate.setResolution(r); setProgress(0, "Ready", `${r} px · ${(ms / 1000).toFixed(1)} s`); }
    catch (e) { console.error(e); setProgress(0, "Switch failed. Try again", String(e.message || e)); }
    busy = false; ui.go.disabled = false;
  }
}

ui.steps.oninput = () => { $("steps-v").textContent = ui.steps.value; $("fast").checked = Number(ui.steps.value) === 25; };
$("fast").onchange = () => { ui.steps.value = $("fast").checked ? 25 : 50; $("steps-v").textContent = ui.steps.value; };
ui.cfg.oninput = () => { $("cfg-v").textContent = Number(ui.cfg.value).toFixed(1); };
ui.dice.onclick = () => { ui.seed.value = Math.floor(Math.random() * 2 ** 31); };
ui.crisp.checked = store.get("agate-crisp") === "1";
const applyCrisp = () => { ui.frame.classList.toggle("crisp", ui.crisp.checked); store.set("agate-crisp", ui.crisp.checked ? "1" : "0"); };
ui.crisp.onchange = applyCrisp; applyCrisp();

let lastSaid = "";
const mb = (b) => (b / 1e6).toFixed(0);
function setProgress(frac, left, right = "") {
  ui.fill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
  ui.status.textContent = left; ui.statusR.textContent = right;
  // screen readers: announce state changes only, not every step / download chunk
  if (!/^(Step|Downloading)/.test(left) && left !== lastSaid) { lastSaid = left; $("announce").textContent = right ? `${left}. ${right}` : left; }
}
function showTimings(rows) {
  ui.timings.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}
function clearOutput() {
  ui.placeholder.hidden = false; ui.aiNote.hidden = true; ui.thinker.hidden = true; ui.save.hidden = true; ui.prepared.hidden = true;
  showTimings([]); last = null;
  if (ui.save.href?.startsWith("blob:")) URL.revokeObjectURL(ui.save.href);
}

async function load() {
  busy = true; ui.go.disabled = true; ui.go.textContent = "Loading…";
  window.__agate.state = "loading";
  agate = new Agate({ base: BASE, override: MODELS_OVERRIDE, version, ep, variant: VARIANT, optLevel: params.get("opt") || "all" });
  try {
    const t0 = performance.now();
    const st = await agate.load(({ phase, file, loaded, total }) => {
      if (phase === "download") setProgress(loaded / total, `Downloading ${file}`, `${mb(loaded)} / ${mb(total)} MB`);
      else setProgress(1, `Preparing ${file} on ${ep === "webgpu" ? "WebGPU" : "CPU"}`, `${mb(total)} MB`);
    }, res());
    const loadMs = performance.now() - t0;
    $("dl-size").textContent = `${st.downloadMB.toFixed(0)} MB`;
    ui.backend.textContent = `backend: ${ep === "webgpu" ? "WebGPU" : "WebAssembly (CPU)"}`;
    const src = st.fromCacheMB > st.downloadMB * 0.99 ? "from browser cache" : "downloaded";
    setProgress(0, "Ready", `Preview ${version} · ${st.downloadMB.toFixed(0)} MB ${src} · ${(loadMs / 1000).toFixed(1)} s`);
    window.__agate = { state: "ready", version, load: { ...st, loadMs, ep } };
    ui.go.textContent = "Generate"; ui.go.disabled = false;
  } catch (e) {
    console.error(e);
    setProgress(0, "Load failed. Check your connection and retry", String(e.message || e));
    window.__agate = { state: "error", version, error: String(e.message || e) };
    ui.go.textContent = "Retry load"; ui.go.disabled = false; agate = null;
  }
  busy = false;
}

async function pngWithMetadata() {
  const blob = await new Promise((r) => ui.canvas.toBlob(r, "image/png"));
  const bytes = addPngText(new Uint8Array(await blob.arrayBuffer()), agate.marks.info);
  return new Blob([bytes], { type: "image/png" });
}

// The previews: frames go to thinkerView, which colours them in a Web Worker and drops frames while busy. The
// sampler never waits for any of it (agate.js sampleFast); with Show thinker off nothing is requested at all.
function previewFn() {
  thinkerView.reset();
  let n = 0, t0 = performance.now();
  window.__agate.thinker = { submitted: 0 };
  thinkerView.onDrawn = ({ step, steps, workerMs, dropped, drawn }) => {
    ui.thinker.hidden = false;
    ui.thinkerStep.textContent = `${step} / ${steps}`;
    window.__agate.thinker = { submitted: n, drawn, dropped, lastWorkerMs: workerMs, lastStep: step };
  };
  return ({ step, steps, plan, x1, hw }) => {
    if (thinkerView.submit(plan, x1, hw, { step, steps })) n++;
  };
}

async function generate(opts = {}) {
  busy = true; stop = false;
  ui.go.textContent = "Stop"; ui.frame.classList.add("busy");
  window.__agate.state = "generating";
  const steps = opts.steps ?? Number(ui.steps.value);
  try {
    setProgress(0, "Encoding prompt", "");
    const r = await agate.generate({
      prompt: opts.prompt ?? ui.prompt.value.trim(), negative: opts.negative ?? ui.negative.value.trim(),
      seed: Number(ui.seed.value) >>> 0, steps, cfg: opts.cfg ?? Number(ui.cfg.value), noise: opts.noise ?? null,
      watermark: opts.watermark ?? true,
      onStep: (i, n) => setProgress(i / n, `Step ${i} / ${n}`, ""),
      onPreview: (opts.thinker ?? ui.showThinker.checked) ? previewFn() : null,
      previewReady: () => !thinkerView.pending,
      shouldStop: () => stop,
    });
    const ctx = ui.canvas.getContext("2d");
    ui.canvas.width = r.width; ui.canvas.height = r.height;
    ctx.putImageData(new ImageData(r.rgba, r.width, r.height), 0, 0);
    ui.placeholder.hidden = true;
    ui.aiNote.hidden = false;
    const T = r.timings;
    setProgress(1, "Done", `${(T.totalMs / 1000).toFixed(1)} s`);
    showTimings([
      ["text encode", `${T.textMs.toFixed(0)} ms (bucket ${T.bucket})`],
      ["per step", `${T.stepMs.toFixed(0)} ms × ${steps} (first ${T.firstStepMs.toFixed(0)} ms)`],
      ["decode + mark", `${T.decodeMs.toFixed(0)} + ${T.markMs.toFixed(0)} ms`],
      ["total", `${(T.totalMs / 1000).toFixed(2)} s`],
    ]);
    const p = r.prepared;
    const changed = agate.mr && (p.text !== (opts.prompt ?? ui.prompt.value.trim()) || p.negative || p.countsNonzero);
    ui.prepared.hidden = !changed;
    if (changed) ui.prepared.textContent = `Model sees: ${p.text}${p.negative ? ` · avoid: ${p.negative}` : ""}${p.countsNonzero ? ` · count code on ${p.countsNonzero} token(s)` : ""}`;
    if (ui.save.href?.startsWith("blob:")) URL.revokeObjectURL(ui.save.href);
    ui.save.href = URL.createObjectURL(await pngWithMetadata());
    ui.save.download = `agate-${version}-${r.width}px-seed${Number(ui.seed.value) >>> 0}.png`;
    ui.save.hidden = false;
    last = r;
    window.__agate = { ...window.__agate, state: "done", timings: T, prepared: p, size: [r.width, r.height], watermarked: r.watermarked,
      thinkerShown: !ui.thinker.hidden };
    return r;
  } catch (e) {
    if (String(e.message) === "stopped") setProgress(0, "Stopped", "");
    else { console.error(e); setProgress(0, "Generation failed. Try again or lower the resolution", String(e.message || e)); window.__agate.error = String(e.message || e); }
    window.__agate.state = "done";
  } finally {
    busy = false; ui.go.textContent = "Generate"; ui.frame.classList.remove("busy");
  }
}

ui.go.onclick = async () => {
  if (busy && agate?.sessions) { stop = true; return; }
  if (busy) return;
  if (!agate) return load();
  return generate();
};
ui.prompt.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && agate && !busy) generate(); });


(async () => {
  renderVersion();
  if (!FORCE_EP) {
    const s = await webgpuStatus();
    if (disposed) return;
    if (!s.ok) {
      gpuOk = false; ep = "wasm";
      $("nogpu").hidden = false; $("nogpu-why").textContent = s.why;
      ui.go.disabled = true; ui.go.textContent = "WebGPU required";
      window.__agate = { state: "no-webgpu", why: s.why, version };
      $("use-wasm").onclick = () => { $("nogpu").hidden = true; gpuOk = true; ui.go.textContent = "Load model (CPU)"; ui.go.disabled = false; };
      return;
    }
    ui.backend.textContent = `backend: WebGPU${s.adapter ? " · " + s.adapter : ""}`;
  }
  ui.go.disabled = false;
  ui.go.textContent = "Load model";
  if (params.has("autoload") || await hasCachedModel(version)) {
    if (disposed) return;   // second visit: load straight from cache
    await load();
  }
})();

return () => { disposed = true; try { thinkerView.worker?.terminate(); } catch {} try { agate?.release(); } catch {} if (ui.save.href?.startsWith("blob:")) URL.revokeObjectURL(ui.save.href); };
}
