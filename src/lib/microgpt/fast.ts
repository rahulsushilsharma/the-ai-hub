/**
 * FastGPT: the same model as microgpt.ts (Karpathy's microgpt), without the scalar autograd.
 * Weights are flat typed arrays; forward caches every activation, backward is written by hand.
 * Same init order and RNG as microgpt.ts, so with the same seed both start from identical weights
 * (scripts/check-microgpt.ts proves the gradients match).
 *
 * wte + wpe -> rmsnorm -> [rmsnorm -> q,k,v -> causal multi-head attention -> wo -> +res;
 *                          rmsnorm -> fc1 -> relu -> fc2 -> +res] x nLayer -> lm_head
 */
import { SeededRandom } from "./microgpt";

type F = Float64Array;
type Mat = { data: F; rows: number; cols: number };

export type FastOptions = {
  nEmbd?: number; nHead?: number; nLayer?: number; blockSize?: number;
  learningRate?: number; numSteps?: number; batchSize?: number; seed?: number;
};

type HeadCache = { scores: number[][]; w: number[][] }; // [pos][j<=pos]
type LayerCache = {
  xin: F[]; s1: number[]; n1: F[]; q: F[]; k: F[]; v: F[]; heads: HeadCache[];
  concat: F[]; ao: F[]; r1: F[]; s2: number[]; n2: F[]; pre: F[]; act: F[]; mo: F[]; r2: F[];
};
type Cache = { tokens: number[]; emb: F[]; s0: number[]; x0: F[]; layers: LayerCache[]; logits: F[] };

const EPS = 1e-5;

/* ---------- tiny linear algebra ---------- */

/** out = W x  (W is rows x cols) */
function mv(W: Mat, x: F): F {
  const out = new Float64Array(W.rows);
  for (let r = 0; r < W.rows; r++) {
    let s = 0;
    const o = r * W.cols;
    for (let c = 0; c < W.cols; c++) s += W.data[o + c] * x[c];
    out[r] = s;
  }
  return out;
}
/** out += Wᵀ dy */
function mtvAdd(W: Mat, dy: F, out: F) {
  for (let r = 0; r < W.rows; r++) {
    const g = dy[r];
    if (g === 0) continue;
    const o = r * W.cols;
    for (let c = 0; c < W.cols; c++) out[c] += W.data[o + c] * g;
  }
}
/** dW += dy ⊗ x */
function outerAdd(dW: F, cols: number, dy: F, x: F) {
  for (let r = 0; r < dy.length; r++) {
    const g = dy[r];
    if (g === 0) continue;
    const o = r * cols;
    for (let c = 0; c < cols; c++) dW[o + c] += g * x[c];
  }
}
function rms(x: F): { y: F; s: number } {
  let ms = 0;
  for (let i = 0; i < x.length; i++) ms += x[i] * x[i];
  const s = 1 / Math.sqrt(ms / x.length + EPS);
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * s;
  return { y, s };
}
/** y = x·s, s = (mean(x²)+eps)^-½  =>  dx = s·dy − (s³/N)·x·Σ(dy·x) */
function rmsBack(x: F, s: number, dy: F): F {
  let dot = 0;
  for (let i = 0; i < x.length; i++) dot += dy[i] * x[i];
  const k = (s * s * s * dot) / x.length;
  const dx = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) dx[i] = s * dy[i] - k * x[i];
  return dx;
}
const add = (a: F, b: F) => { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] + b[i]; return o; };
const softmax = (z: number[]) => {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
};

/* ---------- base64 for checkpoints ---------- */

function toB64(a: F) {
  const bytes = new Uint8Array(Float32Array.from(a).buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return Float64Array.from(new Float32Array(bytes.buffer));
}

export type Checkpoint = {
  config: { nEmbd: number; nHead: number; nLayer: number; blockSize: number };
  chars: string[]; step: number; loss: number;
  curve: { step: number; loss: number }[];
  weights: Record<string, string>;
};

/* ---------- model ---------- */

export class FastGPT {
  rng: SeededRandom;
  config: { nEmbd: number; nHead: number; nLayer: number; blockSize: number; headDim: number };
  learningRate: number;
  numSteps: number;
  batchSize: number;
  beta1 = 0.85;
  beta2 = 0.99;
  epsAdam = 1e-8;
  docs: string[] = [];
  uchars: string[] = [];
  BOS = 0;
  vocabSize = 0;
  W: Record<string, Mat> = {};
  names: string[] = []; // init / export order
  grads: Record<string, F> = {};
  m: Record<string, F> = {};
  v: Record<string, F> = {};
  step = 0;
  initialized = false;

  constructor(o: FastOptions = {}) {
    this.rng = new SeededRandom(o.seed ?? 42);
    this.config = { nEmbd: o.nEmbd ?? 16, nHead: o.nHead ?? 4, nLayer: o.nLayer ?? 1, blockSize: o.blockSize ?? 16, headDim: 0 };
    this.config.headDim = this.config.nEmbd / this.config.nHead;
    this.learningRate = o.learningRate ?? 0.01;
    this.numSteps = o.numSteps ?? 1000;
    this.batchSize = o.batchSize ?? 1;
  }

  loadData(text: string) {
    this.docs = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    this.rng.shuffle(this.docs);
    this.uchars = [...new Set(this.docs.join(""))].sort();
    this.BOS = this.uchars.length;
    this.vocabSize = this.uchars.length + 1;
  }

  initParams() {
    const { nEmbd: n, nLayer, blockSize } = this.config;
    const V = this.vocabSize;
    const shapes: [string, number, number][] = [["wte", V, n], ["wpe", blockSize, n], ["lm_head", V, n]];
    for (let i = 0; i < nLayer; i++) {
      shapes.push([`layer${i}.attn_wq`, n, n], [`layer${i}.attn_wk`, n, n], [`layer${i}.attn_wv`, n, n], [`layer${i}.attn_wo`, n, n],
        [`layer${i}.mlp_fc1`, 4 * n, n], [`layer${i}.mlp_fc2`, n, 4 * n]);
    }
    this.W = {}; this.names = [];
    for (const [name, rows, cols] of shapes) {
      const data = new Float64Array(rows * cols);
      for (let i = 0; i < data.length; i++) data[i] = this.rng.gauss(0, 0.08); // same order as microgpt.ts
      this.W[name] = { data, rows, cols };
      this.names.push(name);
      this.grads[name] = new Float64Array(rows * cols);
      this.m[name] = new Float64Array(rows * cols);
      this.v[name] = new Float64Array(rows * cols);
    }
    this.step = 0;
    this.initialized = true;
    return { numParams: this.numParams(), vocabSize: V, numDocs: this.docs.length };
  }

  numParams() { return this.names.reduce((s, k) => s + this.W[k].data.length, 0); }

  /* ---- forward over a whole sequence, caching everything backward needs ---- */
  forward(tokens: number[]): Cache {
    const { nLayer, nHead, headDim } = this.config;
    const { wte, wpe, lm_head } = this.W;
    const cols = wte.cols;
    const emb: F[] = [], s0: number[] = [], x0: F[] = [];
    tokens.forEach((t, p) => {
      const e = new Float64Array(cols);
      for (let c = 0; c < cols; c++) e[c] = wte.data[t * cols + c] + wpe.data[p * cols + c];
      const r = rms(e);
      emb.push(e); s0.push(r.s); x0.push(r.y);
    });
    let x = x0;
    const layers: LayerCache[] = [];
    const sq = Math.sqrt(headDim);
    for (let l = 0; l < nLayer; l++) {
      const Wq = this.W[`layer${l}.attn_wq`], Wk = this.W[`layer${l}.attn_wk`], Wv = this.W[`layer${l}.attn_wv`];
      const Wo = this.W[`layer${l}.attn_wo`], W1 = this.W[`layer${l}.mlp_fc1`], W2 = this.W[`layer${l}.mlp_fc2`];
      const xin = x;
      const n1r = xin.map(rms);
      const n1 = n1r.map((r) => r.y), s1 = n1r.map((r) => r.s);
      const q = n1.map((a) => mv(Wq, a)), k = n1.map((a) => mv(Wk, a)), v = n1.map((a) => mv(Wv, a));
      const heads: HeadCache[] = [];
      const concat = xin.map(() => new Float64Array(cols));
      for (let h = 0; h < nHead; h++) {
        const o = h * headDim;
        const scores: number[][] = [], w: number[][] = [];
        for (let i = 0; i < tokens.length; i++) {
          const sc: number[] = [];
          for (let j = 0; j <= i; j++) {
            let s = 0;
            for (let c = 0; c < headDim; c++) s += q[i][o + c] * k[j][o + c];
            sc.push(s / sq);
          }
          const wi = softmax(sc);
          for (let j = 0; j <= i; j++) for (let c = 0; c < headDim; c++) concat[i][o + c] += wi[j] * v[j][o + c];
          scores.push(sc); w.push(wi);
        }
        heads.push({ scores, w });
      }
      const ao = concat.map((a) => mv(Wo, a));
      const r1 = xin.map((a, i) => add(a, ao[i]));
      const n2r = r1.map(rms);
      const n2 = n2r.map((r) => r.y), s2 = n2r.map((r) => r.s);
      const pre = n2.map((a) => mv(W1, a));
      const act = pre.map((a) => a.map((z) => (z > 0 ? z : 0)));
      const mo = act.map((a) => mv(W2, a));
      const r2 = r1.map((a, i) => add(a, mo[i]));
      layers.push({ xin, s1, n1, q, k, v, heads, concat, ao, r1, s2, n2, pre, act, mo, r2 });
      x = r2;
    }
    const logits = x.map((a) => mv(lm_head, a));
    return { tokens, emb, s0, x0, layers, logits };
  }

  /* ---- backward: dlogits[i] already holds dLoss/dlogits for position i ---- */
  backward(c: Cache, dlogits: F[]) {
    const { nLayer, nHead, headDim } = this.config;
    const G = this.grads, W = this.W;
    const T = c.tokens.length;
    const xLast = nLayer ? c.layers[nLayer - 1].r2 : c.x0;
    let dx = xLast.map(() => new Float64Array(W.lm_head.cols));
    for (let i = 0; i < T; i++) { outerAdd(G.lm_head, W.lm_head.cols, dlogits[i], xLast[i]); mtvAdd(W.lm_head, dlogits[i], dx[i]); }
    const sq = Math.sqrt(headDim);

    for (let l = nLayer - 1; l >= 0; l--) {
      const L = c.layers[l];
      const p = `layer${l}.`;
      const Wq = W[p + "attn_wq"], Wk = W[p + "attn_wk"], Wv = W[p + "attn_wv"], Wo = W[p + "attn_wo"], W1 = W[p + "mlp_fc1"], W2 = W[p + "mlp_fc2"];
      // MLP: r2 = r1 + fc2(relu(fc1(rms(r1))))
      const dr1 = dx.map((d) => Float64Array.from(d));
      for (let i = 0; i < T; i++) {
        const dmo = dx[i];
        outerAdd(G[p + "mlp_fc2"], W2.cols, dmo, L.act[i]);
        const dact = new Float64Array(W2.cols);
        mtvAdd(W2, dmo, dact);
        for (let j = 0; j < dact.length; j++) if (L.pre[i][j] <= 0) dact[j] = 0;
        outerAdd(G[p + "mlp_fc1"], W1.cols, dact, L.n2[i]);
        const dn2 = new Float64Array(W1.cols);
        mtvAdd(W1, dact, dn2);
        const g = rmsBack(L.r1[i], L.s2[i], dn2);
        for (let j = 0; j < g.length; j++) dr1[i][j] += g[j];
      }
      // attention: r1 = xin + wo(concat(heads(q,k,v)))
      const dxin = dr1.map((d) => Float64Array.from(d));
      const dconcat = dr1.map((d, i) => {
        outerAdd(G[p + "attn_wo"], Wo.cols, d, L.concat[i]);
        const o = new Float64Array(Wo.cols);
        mtvAdd(Wo, d, o);
        return o;
      });
      const dq = L.q.map((a) => new Float64Array(a.length)), dk = L.k.map((a) => new Float64Array(a.length)), dv = L.v.map((a) => new Float64Array(a.length));
      for (let h = 0; h < nHead; h++) {
        const o = h * headDim;
        const { w } = L.heads[h];
        for (let i = 0; i < T; i++) {
          const dw: number[] = [];
          for (let j = 0; j <= i; j++) {
            let s = 0;
            for (let cc = 0; cc < headDim; cc++) { s += dconcat[i][o + cc] * L.v[j][o + cc]; dv[j][o + cc] += w[i][j] * dconcat[i][o + cc]; }
            dw.push(s);
          }
          let dot = 0;
          for (let j = 0; j <= i; j++) dot += w[i][j] * dw[j];
          for (let j = 0; j <= i; j++) {
            const ds = (w[i][j] * (dw[j] - dot)) / sq;
            if (ds === 0) continue;
            for (let cc = 0; cc < headDim; cc++) { dq[i][o + cc] += ds * L.k[j][o + cc]; dk[j][o + cc] += ds * L.q[i][o + cc]; }
          }
        }
      }
      for (let i = 0; i < T; i++) {
        outerAdd(G[p + "attn_wq"], Wq.cols, dq[i], L.n1[i]);
        outerAdd(G[p + "attn_wk"], Wk.cols, dk[i], L.n1[i]);
        outerAdd(G[p + "attn_wv"], Wv.cols, dv[i], L.n1[i]);
        const dn1 = new Float64Array(Wq.cols);
        mtvAdd(Wq, dq[i], dn1); mtvAdd(Wk, dk[i], dn1); mtvAdd(Wv, dv[i], dn1);
        const g = rmsBack(L.xin[i], L.s1[i], dn1);
        for (let j = 0; j < g.length; j++) dxin[i][j] += g[j];
      }
      dx = dxin;
    }
    // embeddings: x0 = rms(wte[t] + wpe[p])
    const cols = W.wte.cols;
    for (let i = 0; i < T; i++) {
      const g = rmsBack(c.emb[i], c.s0[i], dx[i]);
      const t = c.tokens[i];
      for (let j = 0; j < cols; j++) { G.wte[t * cols + j] += g[j]; G.wpe[i * cols + j] += g[j]; }
    }
  }

  trainStep() {
    if (!this.initialized) throw new Error("Not initialized. Call loadData() and initParams() first.");
    const { blockSize } = this.config;
    const B = this.batchSize;
    let loss = 0;
    let first: { doc: string; tokens: number[]; posLosses: number[] } | null = null;
    for (let b = 0; b < B; b++) {
      const doc = this.docs[(this.step * B + b) % this.docs.length];
      const tokens = [this.BOS, ...[...doc].map((ch) => this.uchars.indexOf(ch)), this.BOS];
      const n = Math.min(blockSize, tokens.length - 1);
      const c = this.forward(tokens.slice(0, n));
      const posLosses: number[] = [];
      const dlogits = c.logits.map((lg, i) => {
        const p = softmax([...lg]);
        const target = tokens[i + 1];
        posLosses.push(-Math.log(p[target]));
        const d = new Float64Array(p.length);
        for (let j = 0; j < p.length; j++) d[j] = (p[j] - (j === target ? 1 : 0)) / (n * B);
        return d;
      });
      this.backward(c, dlogits);
      loss += posLosses.reduce((a, x) => a + x, 0) / n / B;
      if (!first) first = { doc, tokens, posLosses };
    }
    // Adam with linear decay, exactly as microgpt.ts
    const step = this.step;
    const lrT = Math.max(0, this.learningRate * (1 - step / this.numSteps));
    const bc1 = 1 - this.beta1 ** (step + 1), bc2 = 1 - this.beta2 ** (step + 1);
    for (const k of this.names) {
      const w = this.W[k].data, g = this.grads[k], m = this.m[k], v = this.v[k];
      for (let i = 0; i < w.length; i++) {
        m[i] = this.beta1 * m[i] + (1 - this.beta1) * g[i];
        v[i] = this.beta2 * v[i] + (1 - this.beta2) * g[i] * g[i];
        w[i] -= (lrT * (m[i] / bc1)) / (Math.sqrt(v[i] / bc2) + this.epsAdam);
        g[i] = 0;
      }
    }
    this.step++;
    return { step: this.step, loss, doc: first!.doc, tokens: first!.tokens, learningRate: lrT, posLosses: first!.posLosses };
  }

  /** Every intermediate activation per position, in the shape the Explain view expects. */
  trace(tokens: number[]) {
    const c = this.forward(tokens);
    const A = (a: F) => Array.from(a);
    const { wte, wpe } = this.W;
    const n = wte.cols;
    return tokens.map((t, i) => ({
      tokEmb: Array.from(wte.data.subarray(t * n, t * n + n)),
      posEmb: Array.from(wpe.data.subarray(i * n, i * n + n)),
      embSum: A(c.emb[i]),
      x0: A(c.x0[i]),
      layers: c.layers.map((L) => ({
        xIn: A(L.xin[i]), norm1: A(L.n1[i]), q: A(L.q[i]), k: A(L.k[i]), v: A(L.v[i]),
        heads: L.heads.map((h, hi) => {
          const o = hi * this.config.headDim;
          return { scores: h.scores[i], weights: h.w[i], out: Array.from(L.concat[i].subarray(o, o + this.config.headDim)) };
        }),
        concat: A(L.concat[i]), attnOut: A(L.ao[i]), res1: A(L.r1[i]),
        norm2: A(L.n2[i]), mlpPre: A(L.pre[i]), mlpAct: A(L.act[i]), mlpOut: A(L.mo[i]), res2: A(L.r2[i]),
      })),
      logits: A(c.logits[i]),
    }));
  }

  generate(temperature = 0.5) {
    const tokens = [this.BOS];
    const out: string[] = [];
    for (let pos = 0; pos < this.config.blockSize; pos++) {
      const c = this.forward(tokens);
      const probs = softmax([...c.logits[c.logits.length - 1]].map((l) => l / temperature));
      const id = this.rng.weightedChoice(probs.map((_, i) => i), probs);
      if (id === this.BOS) break;
      out.push(this.uchars[id]);
      tokens.push(id);
    }
    return { text: out.join("") };
  }

  getEmbeddings() {
    const { data, cols } = this.W.wte;
    return Array.from({ length: this.vocabSize }, (_, i) => ({
      tokenId: i,
      char: i < this.uchars.length ? this.uchars[i] : "<BOS>",
      embedding: Array.from(data.subarray(i * cols, i * cols + cols)),
    }));
  }

  getConfig() { return { ...this.config, vocabSize: this.vocabSize, numDocs: this.docs.length }; }

  exportWeights() {
    return Object.fromEntries(this.names.map((k) => [k, toB64(this.W[k].data)]));
  }

  /** Load a checkpoint; returns false (and changes nothing) if it does not fit this model. */
  importWeights(ck: Checkpoint) {
    const c = this.config;
    if (ck.config.nEmbd !== c.nEmbd || ck.config.nHead !== c.nHead || ck.config.nLayer !== c.nLayer || ck.config.blockSize !== c.blockSize) return false;
    if (ck.chars.join("") !== this.uchars.join("")) return false;
    const loaded: Record<string, F> = {};
    for (const k of this.names) {
      const a = ck.weights[k] ? fromB64(ck.weights[k]) : null;
      if (!a || a.length !== this.W[k].data.length) return false;
      loaded[k] = a;
    }
    for (const k of this.names) this.W[k].data.set(loaded[k]);
    this.step = ck.step;
    return true;
  }
}
