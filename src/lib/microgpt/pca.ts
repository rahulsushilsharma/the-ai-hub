// Project vectors onto their top 2 principal components (power iteration with deflation).
export function pca2(vecs: number[][]): [number, number][] {
  const n = vecs.length, d = vecs[0]?.length ?? 0;
  if (n === 0 || d === 0) return [];
  const mean = Array.from({ length: d }, (_, j) => vecs.reduce((s, v) => s + v[j], 0) / n);
  const X = vecs.map((v) => v.map((a, j) => a - mean[j]));
  const comps: number[][] = [];
  const work = X.map((r) => [...r]);
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: d }, (_, j) => Math.sin(j + 1 + c)); // deterministic start
    for (let it = 0; it < 60; it++) {
      const Xv = work.map((r) => r.reduce((s, a, j) => s + a * v[j], 0));
      const next = Array.from({ length: d }, (_, j) => work.reduce((s, r, i) => s + r[j] * Xv[i], 0));
      const norm = Math.hypot(...next) || 1;
      v = next.map((a) => a / norm);
    }
    comps.push(v);
    for (const r of work) {
      const p = r.reduce((s, a, j) => s + a * v[j], 0);
      for (let j = 0; j < d; j++) r[j] -= p * v[j];
    }
  }
  return X.map((r) => [
    r.reduce((s, a, j) => s + a * comps[0][j], 0),
    r.reduce((s, a, j) => s + a * comps[1][j], 0),
  ]);
}
