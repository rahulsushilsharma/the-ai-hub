// @ts-nocheck
/* eslint-disable */
// Ported from Logolabs/agate-webgpu (MIT).
// Web Worker: colours the thinker previews off the main thread (see thinker.js).
import { planPixels, predPixels } from "./thinker";

let gen = -1, state = {};
self.onmessage = (e) => {
  const { gen: g, plan, x1, hw, meta } = e.data;
  if (g !== gen) { gen = g; state = {}; }           // a new generation: fit a new basis at its first frame
  const t0 = performance.now();
  const p = planPixels(plan, state), q = predPixels(x1, hw);
  self.postMessage({ gen: g, plan: p, pred: q, hw, meta, ms: performance.now() - t0 }, [p.buffer, q.buffer]);
};
