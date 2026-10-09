// @ts-nocheck
/* eslint-disable */
// Ported from Logolabs/agate-webgpu (MIT).
// "Show thinker": the live previews of the ComfyUI nodes (agate-comfyui nodes.py, _progress, live_preview
// "side_by_side"), computed the same way so the two frontends show the same thing:
//  * the plan: the thinker's output for the conditional branch, 640 channels on a 16 x 16 grid. Its cells are
//    projected on the top 3 principal components (fitted once, at the first step, centred over the cells; each
//    component's sign fixed so its largest-magnitude loading is positive) and mapped to RGB with that step's 2% /
//    98% quantiles -- a fixed basis, so a colour keeps its meaning while the plan evolves;
//  * the image the model expects at the end, x1 = z + (1 - t) v (guided velocity), shown with ComfyUI's SD 1.5
//    latent -> RGB factors (its "latent2rgb" preview).

const RGB_FACTORS = [[0.3512, 0.2297, 0.3227], [0.3250, 0.4974, 0.2350], [-0.2829, 0.1762, 0.2721], [-0.2120, -0.2616, -0.7177]];

// top-k eigenvectors of the (d x d) Gram matrix X^T X of centred X (n x d), as torch.linalg.eigh gives them (sign
// aside), via the smaller (n x n) X X^T: block (subspace) iteration with a 12-vector block + Rayleigh-Ritz, which
// separates near-equal eigenvalues that plain power iteration mixes; then v = X^T u / |X^T u|.
function jacobiEig(A, m) {                     // symmetric m x m (Float64Array) -> {vals, vecs (column-major rows)}
  const a = Float64Array.from(A), V = new Float64Array(m * m);
  for (let i = 0; i < m; i++) V[i * m + i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < m; p++) for (let q = p + 1; q < m; q++) off += a[p * m + q] ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < m; p++) for (let q = p + 1; q < m; q++) {
      const apq = a[p * m + q];
      if (Math.abs(apq) < 1e-300) continue;
      const th = (a[q * m + q] - a[p * m + p]) / (2 * apq);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < m; k++) { const x = a[k * m + p], y = a[k * m + q]; a[k * m + p] = c * x - s * y; a[k * m + q] = s * x + c * y; }
      for (let k = 0; k < m; k++) { const x = a[p * m + k], y = a[q * m + k]; a[p * m + k] = c * x - s * y; a[q * m + k] = s * x + c * y; }
      for (let k = 0; k < m; k++) { const x = V[k * m + p], y = V[k * m + q]; V[k * m + p] = c * x - s * y; V[k * m + q] = s * x + c * y; }
    }
  }
  return { vals: Array.from({ length: m }, (_, i) => a[i * m + i]), V };
}

function topComponents(X, n, d, k = 3, iters = 60, block = 12) {
  const G = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    let s = 0; const ri = i * d, rj = j * d;
    for (let a = 0; a < d; a++) s += X[ri + a] * X[rj + a];
    G[i * n + j] = G[j * n + i] = s;
  }
  const m = Math.min(block, n);
  let Q = Array.from({ length: m }, (_, c) => Float64Array.from({ length: n }, (_, i) => Math.sin(1.7 * i + 0.9 * c + 1) + 0.01 * c));
  const orth = (B) => {                        // modified Gram-Schmidt, in place
    for (let c = 0; c < B.length; c++) {
      for (let e = 0; e < c; e++) { let p = 0; for (let i = 0; i < n; i++) p += B[c][i] * B[e][i]; for (let i = 0; i < n; i++) B[c][i] -= p * B[e][i]; }
      let nrm = 0; for (let i = 0; i < n; i++) nrm += B[c][i] ** 2; nrm = Math.sqrt(nrm) || 1;
      for (let i = 0; i < n; i++) B[c][i] /= nrm;
    }
    return B;
  };
  const mul = (q) => { const w = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; const gi = i * n; for (let j = 0; j < n; j++) s += G[gi + j] * q[j]; w[i] = s; } return w; };
  orth(Q);
  for (let it = 0; it < iters; it++) Q = orth(Q.map(mul));
  const GQ = Q.map(mul), T = new Float64Array(m * m);           // Rayleigh-Ritz on the block
  for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) { let s = 0; for (let i = 0; i < n; i++) s += Q[a][i] * GQ[b][i]; T[a * m + b] = s; }
  for (let a = 0; a < m; a++) for (let b = 0; b < a; b++) T[a * m + b] = T[b * m + a] = (T[a * m + b] + T[b * m + a]) / 2;
  const { vals, V } = jacobiEig(T, m);
  const order = vals.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, k).map((x) => x[1]);
  return order.map((col) => {
    const u = new Float64Array(n);
    for (let a = 0; a < m; a++) { const w = V[a * m + col]; for (let i = 0; i < n; i++) u[i] += w * Q[a][i]; }
    const v = new Float64Array(d);
    for (let i = 0; i < n; i++) { const ui = u[i], ri = i * d; if (ui) for (let a = 0; a < d; a++) v[a] += ui * X[ri + a]; }
    let nrm = 0; for (let a = 0; a < d; a++) nrm += v[a] * v[a]; nrm = Math.sqrt(nrm) || 1;
    let piv = 0;
    for (let a = 0; a < d; a++) { v[a] /= nrm; if (Math.abs(v[a]) > Math.abs(v[piv])) piv = a; }
    if (v[piv] < 0) for (let a = 0; a < d; a++) v[a] = -v[a];
    return v;
  });
}

function quantile(sorted, q) {                 // torch.quantile, linear interpolation
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// state: { basis, lo, hi } (filled at the first call of a generation). -> RGBA Uint8ClampedArray (g * g * 4)
export function planPixels(plan, state, C = 640, g = 16) {
  const n = g * g, X = new Float64Array(n * C);
  for (let c = 0; c < C; c++) for (let p = 0; p < n; p++) X[p * C + c] = plan[c * n + p];
  for (let c = 0; c < C; c++) { let m = 0; for (let p = 0; p < n; p++) m += X[p * C + c]; m /= n; for (let p = 0; p < n; p++) X[p * C + c] -= m; }
  if (!state.basis) state.basis = topComponents(X, n, C);
  const Y = state.basis.map((v) => { const y = new Float64Array(n); for (let p = 0; p < n; p++) { let s = 0; const r = p * C; for (let c = 0; c < C; c++) s += X[r + c] * v[c]; y[p] = s; } return y; });
  if (!state.lo) {
    state.lo = Y.map((y) => quantile(Float64Array.from(y).sort(), 0.02));
    state.hi = Y.map((y) => quantile(Float64Array.from(y).sort(), 0.98));
  }
  const px = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    for (let k = 0; k < 3; k++) px[p * 4 + k] = Math.round(Math.min(1, Math.max(0, (Y[k][p] - state.lo[k]) / (state.hi[k] - state.lo[k] + 1e-8))) * 255);
    px[p * 4 + 3] = 255;
  }
  return px;
}

// x1: Float32Array (4 * hw * hw) in the model's (scaled SD-VAE) latent space -> RGBA (hw * hw * 4)
export function predPixels(x1, hw) {
  const n = hw * hw, px = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    for (let k = 0; k < 3; k++) {
      let s = 0; for (let c = 0; c < 4; c++) s += x1[c * n + p] * RGB_FACTORS[c][k];
      px[p * 4 + k] = Math.floor(Math.min(1, Math.max(0, (s + 1) / 2)) * 255);
    }
    px[p * 4 + 3] = 255;
  }
  return px;
}

// Draws previews; the colouring runs in a Web Worker (thinker-worker.js) when available, so the page and the
// sampler never wait for it. A frame arriving while the previous one is still being coloured is dropped.
export class ThinkerView {
  constructor(planCanvas, predCanvas, onDrawn = () => {}) {
    this.planCanvas = planCanvas; this.predCanvas = predCanvas; this.onDrawn = onDrawn;
    this.gen = 0; this.busy = false; this.dropped = 0; this.drawn = 0;
    try {
      this.worker = new Worker(new URL("./thinker-worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e) => this._paint(e.data);
    } catch { this.worker = null; }
    this.reset();
  }

  reset() { this.gen++; this.state = {}; this.busy = false; this.dropped = 0; this.drawn = 0; }

  get pending() { return this.busy; }

  // plan: Float32Array (640 * 16 * 16), x1: Float32Array (4 * hw * hw); both are transferred to the worker
  submit(plan, x1, hw, meta = {}) {
    if (this.busy) { this.dropped++; return false; }
    this.busy = true;
    const job = { gen: this.gen, plan, x1, hw, meta };
    if (this.worker) this.worker.postMessage(job, [plan.buffer, x1.buffer]);
    else setTimeout(() => this._paint({ gen: job.gen, hw, meta, plan: planPixels(plan, this.state), pred: predPixels(x1, hw) }), 0);
    return true;
  }

  _paint({ gen, plan, pred, hw, meta, ms }) {
    this.busy = false;
    if (gen !== this.gen) return;
    const put = (cv, px, s) => { cv.width = s; cv.height = s; cv.getContext("2d").putImageData(new ImageData(px, s, s), 0, 0); };
    put(this.planCanvas, plan, 16);
    put(this.predCanvas, pred, hw);
    this.drawn++;
    this.onDrawn({ ...meta, workerMs: ms, dropped: this.dropped, drawn: this.drawn });
  }

  // synchronous path (tests): colour on this thread
  drawPlan(plan) { const px = planPixels(plan, this.state); const cv = this.planCanvas; cv.width = 16; cv.height = 16; cv.getContext("2d").putImageData(new ImageData(px, 16, 16), 0, 0); }
}
