// @ts-nocheck
/* eslint-disable */
// Ported from Logolabs/agate-webgpu (MIT).
// AI-generated content marking for the images this page makes (EU AI Act Art. 50(2)), the same marks as the
// Python packages (agate/marking.py of Logolabs/agate-preview-002 / -003):
//  * an invisible watermark in the pixels: invisible-watermark's (MIT) 'dwtDctSvd' method, fixed 64-bit payload
//    "AGATE" + release ("AGATE001" / "AGATE002" / "AGATE003"), ported from the library with its exact conventions
//    (OpenCV 8-bit YUV, U channel only, Haar LL band, 4x4 DCT + SVD, s0 quantised to 36, the library's swapped
//    detail order in the inverse DWT, numpy's truncating uint8 cast). agate.detect_watermark() in Python reads it.
//  * provenance text chunks (tEXt) in the downloaded PNG: ai_generated, generator, model, watermark -- the keys
//    and values the Python packages write. The prompt is NOT written.
// Neither mark is tamper-proof; see the model cards.

export const METHOD = "dwtDctSvd";
const SCALE = 36, BLOCK = 4;
const S2 = 0.7071067811865476;                      // PyWavelets' Haar tap, 1/sqrt(2)

export function marks(release) {
  const payload = "AGATE" + release;               // 8 ASCII bytes = 64 bits
  return {
    payload,
    info: {
      ai_generated: "true",
      generator: `Agate Preview ${release} (LogoLabs)`,
      model: `Logolabs/agate-preview-${release}`,
      watermark: `invisible-watermark ${METHOD}, payload ${payload}`,
    },
  };
}

const desc = (x) => (x + 8192) >> 14;               // OpenCV CV_DESCALE(x, 14)
const sat = (x) => (x < 0 ? 0 : x > 255 ? 255 : x);
const u8unsafe = (x) => { const t = Math.trunc(x) % 256; return t < 0 ? t + 256 : t; };   // numpy float -> uint8

// orthonormal 4-point DCT-II matrix (cv2.dct on a 4x4 block = C X C^T)
const C = [];
for (let k = 0; k < BLOCK; k++) {
  C.push([]);
  for (let n = 0; n < BLOCK; n++) C[k].push(Math.sqrt(k === 0 ? 1 / BLOCK : 2 / BLOCK) * Math.cos(Math.PI * (2 * n + 1) * k / (2 * BLOCK)));
}
function mul(A, B) { const R = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j]; R[i][j] = s; } return R; }
const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const CT = T(C);

// largest singular value of a 4x4 matrix and its singular vectors (Jacobi on D^T D)
function topSVD(D) {
  const M = mul(T(D), D);
  const V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += M[p][q] * M[p][q];
    if (off < 1e-30) break;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
      if (Math.abs(M[p][q]) < 1e-300) continue;
      const th = (M[q][q] - M[p][p]) / (2 * M[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 4; k++) { const a = M[k][p], b = M[k][q]; M[k][p] = c * a - s * b; M[k][q] = s * a + c * b; }
      for (let k = 0; k < 4; k++) { const a = M[p][k], b = M[q][k]; M[p][k] = c * a - s * b; M[q][k] = s * a + c * b; }
      for (let k = 0; k < 4; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (M[i][i] > M[best][best]) best = i;
  const s0 = Math.sqrt(Math.max(0, M[best][best]));
  let v = V.map((r) => r[best]), u;
  if (s0 < 1e-12) { u = [1, 0, 0, 0]; v = [1, 0, 0, 0]; }
  else u = D.map((r) => (r[0] * v[0] + r[1] * v[1] + r[2] * v[2] + r[3] * v[3]) / s0);
  return { s0, u, v };
}

function payloadBits(payload) {
  const bytes = new TextEncoder().encode(payload), bits = [];
  for (const b of bytes) for (let k = 7; k >= 0; k--) bits.push((b >> k) & 1);
  return bits;
}

// U channel (OpenCV BGR2YUV, 8 bit) of an RGBA buffer -> Int32Array(W*H), plus Y and V for the inverse
function toYUV(rgba, W, H) {
  const Y = new Int32Array(W * H), U = new Int32Array(W * H), V = new Int32Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const r = rgba[4 * p], g = rgba[4 * p + 1], b = rgba[4 * p + 2];
    const y = desc(b * 1868 + g * 9617 + r * 4899);
    Y[p] = y; U[p] = sat(desc((b - y) * 8061 + (128 << 14))); V[p] = sat(desc((r - y) * 14369 + (128 << 14)));
  }
  return { Y, U, V };
}

// LL band of the Haar DWT of U over the (H//4*4, W//4*4) region; -> {ca, ch, cv, cd} as Float64Array (h2 x w2)
function haar(U, W, R, Cc) {
  const h2 = R / 2, w2 = Cc / 2, n = h2 * w2;
  const ca = new Float64Array(n), ch = new Float64Array(n), cv = new Float64Array(n), cd = new Float64Array(n);
  for (let i = 0; i < h2; i++) for (let j = 0; j < w2; j++) {
    const a = U[(2 * i) * W + 2 * j], b = U[(2 * i) * W + 2 * j + 1], c = U[(2 * i + 1) * W + 2 * j], d = U[(2 * i + 1) * W + 2 * j + 1];
    const k = i * w2 + j;
    // PyWavelets' exact float order: pairs along rows first (a|c, b|d), then along columns
    const l0 = a * S2 + c * S2, l1 = b * S2 + d * S2, h0 = a * S2 - c * S2, h1 = b * S2 - d * S2;
    ca[k] = l0 * S2 + l1 * S2; cv[k] = l0 * S2 - l1 * S2; ch[k] = h0 * S2 + h1 * S2; cd[k] = h0 * S2 - h1 * S2;
  }
  return { ca, ch, cv, cd, h2, w2 };
}

function blockAt(ca, w2, bi, bj) { const B = []; for (let r = 0; r < 4; r++) { B.push([]); for (let c = 0; c < 4; c++) B[r].push(ca[(bi * 4 + r) * w2 + bj * 4 + c]); } return B; }

// Embed `payload` in place into rgba (Uint8ClampedArray / Uint8Array, W*H*4). Needs W*H >= 256*256.
export function embedWatermark(rgba, W, H, payload) {
  if (W * H < 256 * 256) throw new Error("watermark: image too small (needs at least 256 x 256)");
  const bits = payloadBits(payload);
  const { Y, U, V } = toYUV(rgba, W, H);
  const R = Math.floor(H / 4) * 4, Cc = Math.floor(W / 4) * 4;
  const { ca, ch, cv, cd, h2, w2 } = haar(U, W, R, Cc);
  const nbi = Math.floor(h2 / 4), nbj = Math.floor(w2 / 4);
  let num = 0;
  for (let bi = 0; bi < nbi; bi++) for (let bj = 0; bj < nbj; bj++, num++) {
    const D = mul(mul(C, blockAt(ca, w2, bi, bj)), CT);
    const { s0, u, v } = topSVD(D);
    const s1 = (Math.floor(s0 / SCALE) + 0.25 + 0.5 * bits[num % bits.length]) * SCALE;
    const Dn = D.map((row, i) => row.map((x, j) => x + (s1 - s0) * u[i] * v[j]));
    const Bn = mul(mul(CT, Dn), C);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) ca[(bi * 4 + r) * w2 + bj * 4 + c] = Bn[r][c];
  }
  // inverse Haar with the library's swapped details (cv as H, ch as V), truncating uint8 cast
  for (let i = 0; i < h2; i++) for (let j = 0; j < w2; j++) {
    // pywt.idwt2((ca, (cv, ch, cd))): the library's swapped details; PyWavelets' float order (columns, then rows)
    const k = i * w2 + j, A = ca[k], hIn = cv[k], vIn = ch[k], d = cd[k];
    const L0 = A * S2 + vIn * S2, L1 = A * S2 - vIn * S2, H0 = hIn * S2 + d * S2, H1 = hIn * S2 - d * S2;
    U[(2 * i) * W + 2 * j] = u8unsafe(L0 * S2 + H0 * S2);
    U[(2 * i) * W + 2 * j + 1] = u8unsafe(L1 * S2 + H1 * S2);
    U[(2 * i + 1) * W + 2 * j] = u8unsafe(L0 * S2 - H0 * S2);
    U[(2 * i + 1) * W + 2 * j + 1] = u8unsafe(L1 * S2 - H1 * S2);
  }
  for (let p = 0; p < W * H; p++) {                  // OpenCV YUV2BGR, 8 bit
    const y = Y[p], uu = U[p] - 128, vq = V[p] - 128;
    rgba[4 * p + 2] = sat(y + desc(uu * 33292));
    rgba[4 * p + 1] = sat(y + desc(uu * -6472 + vq * -9519));
    rgba[4 * p] = sat(y + desc(vq * 18678));
  }
  return rgba;
}

// -> {bits, text, bitAccuracy} against `payload` (a self-check; the reference detector is the Python one)
export function readWatermark(rgba, W, H, payload) {
  const want = payloadBits(payload), n = want.length;
  const { U } = toYUV(rgba, W, H);
  const R = Math.floor(H / 4) * 4, Cc = Math.floor(W / 4) * 4;
  const { ca, h2, w2 } = haar(U, W, R, Cc);
  const nbi = Math.floor(h2 / 4), nbj = Math.floor(w2 / 4);
  const sum = new Float64Array(n), cnt = new Float64Array(n);
  let num = 0;
  for (let bi = 0; bi < nbi; bi++) for (let bj = 0; bj < nbj; bj++, num++) {
    const { s0 } = topSVD(mul(mul(C, blockAt(ca, w2, bi, bj)), CT));
    sum[num % n] += (s0 % SCALE) > SCALE * 0.5 ? 1 : 0; cnt[num % n] += 1;
  }
  const bits = Array.from(sum, (s, k) => (s / cnt[k]) * 255 > 127 ? 1 : 0);
  let same = 0; bits.forEach((b, k) => { if (b === want[k]) same++; });
  const bytes = []; for (let k = 0; k < n; k += 8) { let b = 0; for (let q = 0; q < 8; q++) b = (b << 1) | bits[k + q]; bytes.push(b); }
  return { bits, text: String.fromCharCode(...bytes), bitAccuracy: same / n };
}

// ---- PNG tEXt chunks ---------------------------------------------------------------------------
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) { CRC_TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// PNG bytes -> PNG bytes with one tEXt chunk per entry of `info` (Latin-1 keys/values), inserted before IEND.
export function addPngText(png, info) {
  const latin1 = (s) => Uint8Array.from(s, (ch) => { const c = ch.charCodeAt(0); return c < 256 ? c : 63; });
  const chunks = [];
  for (const [k, v] of Object.entries(info)) {
    const data = new Uint8Array([...latin1(k), 0, ...latin1(String(v))]);
    const typeData = new Uint8Array([116, 69, 88, 116, ...data]);          // "tEXt"
    const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
    dv.setUint32(0, data.length); out.set(typeData, 4); dv.setUint32(8 + data.length, crc32(typeData));
    chunks.push(out);
  }
  // find IEND (the last chunk): 12 bytes from the end in every well-formed PNG
  const iend = png.length - 12;
  const extra = chunks.reduce((s, c) => s + c.length, 0);
  const res = new Uint8Array(png.length + extra);
  res.set(png.subarray(0, iend), 0);
  let o = iend;
  for (const c of chunks) { res.set(c, o); o += c.length; }
  res.set(png.subarray(iend), o);
  return res;
}
