/**
 * StoryGPT inference: Microsoft's pretrained TinyStories-3M, converted by scripts/tinystories/convert.py, run here in plain JS.
 * GPT-Neo's quirks are folded into the weights there, so this is plain GPT-2 maths
 * (scripts/check-story.ts compares the logits with Hugging Face's implementation). One token at a time
 * with a key/value cache, so a prompt and a generation go through the exact same code path.
 *
 * wte + wpe -> [x += attn(ln1(x)); x += fc2(gelu(fc(ln2(x))))] x nLayer -> lnf -> wteᵀ
 */
import { SeededRandom } from "./microgpt";

type F = Float32Array;
export type StoryConfig = { vocab: number; ctx: number; n_layer: number; n_embd: number; n_head: number };
export type StoryMeta = {
  config: StoryConfig; params: number; eot: number;
  tensors: { name: string; shape: number[]; offset: number }[];
  source: { repo: string; url: string; paper: string; stories: number; arch: string };
  prompts: string[];
};
export type KV = { k: F[]; v: F[]; pos: number };
/** What one block did to one token: attention's and the MLP's additions to the residual stream, and the stream after both. */
export type LayerFlow = { attn: F; hid: F; mlp: F; resid: F };
export type StepOut = { logits: F; x0?: F; attn?: F[][]; flow?: LayerFlow[] }; // attn[layer][head][0..pos]

const EPS = 1e-5;

function half(h: number) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

/** out = W x + b, W is [rows, cols] row-major (PyTorch Linear layout) */
function linear(W: F, b: F, x: F, rows: number, cols: number) {
  const out = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    let s = b[r];
    const o = r * cols;
    for (let c = 0; c < cols; c++) s += W[o + c] * x[c];
    out[r] = s;
  }
  return out;
}
function layerNorm(x: F, w: F, b: F) {
  const n = x.length;
  let mu = 0, va = 0;
  for (let i = 0; i < n; i++) mu += x[i];
  mu /= n;
  for (let i = 0; i < n; i++) va += (x[i] - mu) ** 2;
  const s = 1 / Math.sqrt(va / n + EPS);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = (x[i] - mu) * s * w[i] + b[i];
  return y;
}
const K = Math.sqrt(2 / Math.PI);
const gelu = (z: number) => 0.5 * z * (1 + Math.tanh(K * (z + 0.044715 * z * z * z)));

export class StoryGPT {
  meta: StoryMeta;
  c: StoryConfig;
  W: Record<string, F> = {};

  constructor(meta: StoryMeta, buf?: ArrayBuffer, seed = 0) {
    this.meta = meta;
    this.c = meta.config;
    const u16 = buf && new Uint16Array(buf);
    const rng = new SeededRandom(seed);
    for (const t of meta.tensors) {
      const n = t.shape.reduce((a, b) => a * b, 1);
      const a = new Float32Array(n);
      if (u16) for (let i = 0; i < n; i++) a[i] = half(u16[t.offset + i]);
      // untrained twin: a standard GPT-2 initialisation, i.e. where training would have started
      else if (t.name.endsWith("ln1.w") || t.name.endsWith("ln2.w") || t.name === "lnf.w") a.fill(1);
      else if (t.shape.length === 2) {
        const sd = 0.02 / (/proj\.w|fc2\.w/.test(t.name) ? Math.sqrt(2 * this.c.n_layer) : 1);
        for (let i = 0; i < n; i++) a[i] = rng.gauss(0, sd);
      }
      this.W[t.name] = a;
    }
  }

  newKV(): KV {
    const { n_layer, ctx, n_embd } = this.c;
    return { k: Array.from({ length: n_layer }, () => new Float32Array(ctx * n_embd)), v: Array.from({ length: n_layer }, () => new Float32Array(ctx * n_embd)), pos: 0 };
  }

  /** Feed one token at kv.pos; returns next-token logits. `capture` also returns attention weights and what each block did. */
  step(kv: KV, token: number, capture = false): StepOut {
    const { n_layer, n_embd: C, n_head, ctx } = this.c;
    const W = this.W, p = kv.pos;
    if (p >= ctx) throw new Error(`context full (${ctx} tokens)`);
    const hd = C / n_head, sq = Math.sqrt(hd);
    let x = new Float32Array(C);
    for (let i = 0; i < C; i++) x[i] = W.wte[token * C + i] + W.wpe[p * C + i];
    const x0 = x.slice();
    const attn: F[][] = [], flow: LayerFlow[] = [];
    for (let l = 0; l < n_layer; l++) {
      const h = `h${l}.`;
      const qkv = linear(W[h + "qkv.w"], W[h + "qkv.b"], layerNorm(x, W[h + "ln1.w"], W[h + "ln1.b"]), 3 * C, C);
      const Kc = kv.k[l], Vc = kv.v[l];
      Kc.set(qkv.subarray(C, 2 * C), p * C);
      Vc.set(qkv.subarray(2 * C), p * C);
      const y = new Float32Array(C);
      const heads: F[] = [];
      for (let hh = 0; hh < n_head; hh++) {
        const o = hh * hd;
        const w = new Float32Array(p + 1);
        let m = -Infinity;
        for (let j = 0; j <= p; j++) {
          let s = 0;
          for (let d = 0; d < hd; d++) s += qkv[o + d] * Kc[j * C + o + d];
          w[j] = s / sq;
          if (w[j] > m) m = w[j];
        }
        let z = 0;
        for (let j = 0; j <= p; j++) z += (w[j] = Math.exp(w[j] - m));
        for (let j = 0; j <= p; j++) {
          w[j] /= z;
          for (let d = 0; d < hd; d++) y[o + d] += w[j] * Vc[j * C + o + d];
        }
        heads.push(w);
      }
      const a = linear(W[h + "proj.w"], W[h + "proj.b"], y, C, C);
      for (let i = 0; i < C; i++) x[i] += a[i];
      const hid = linear(W[h + "fc.w"], W[h + "fc.b"], layerNorm(x, W[h + "ln2.w"], W[h + "ln2.b"]), 4 * C, C).map(gelu);
      const mo = linear(W[h + "fc2.w"], W[h + "fc2.b"], hid, C, 4 * C);
      x = x.map((v, i) => v + mo[i]);
      if (capture) { attn.push(heads); flow.push({ attn: a, hid, mlp: mo, resid: x.slice() }); }
    }
    kv.pos++;
    return { logits: this.head(x), ...(capture && { x0, attn, flow }) };
  }

  /** Final LayerNorm, then score every token against its (tied) embedding. Also used for the logit lens. */
  head(x: F) {
    const { vocab, n_embd: C } = this.c;
    const n = layerNorm(x, this.W["lnf.w"], this.W["lnf.b"]);
    const out = new Float32Array(vocab);
    for (let t = 0; t < vocab; t++) {
      let s = 0;
      const o = t * C;
      for (let i = 0; i < C; i++) s += this.W.wte[o + i] * n[i];
      out[t] = s;
    }
    return out;
  }
}

export function softmax(logits: F, temp = 1) {
  let m = -Infinity;
  for (const v of logits) if (v > m) m = v;
  const p = new Float32Array(logits.length);
  let z = 0;
  for (let i = 0; i < p.length; i++) z += (p[i] = Math.exp((logits[i] - m) / temp));
  for (let i = 0; i < p.length; i++) p[i] /= z;
  return p;
}

/** indices of the k largest values, largest first */
export function topK(a: F, k: number) {
  const idx: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (idx.length < k || a[i] > a[idx[idx.length - 1]]) {
      idx.push(i);
      idx.sort((x, y) => a[y] - a[x]);
      if (idx.length > k) idx.pop();
    }
  }
  return idx;
}
