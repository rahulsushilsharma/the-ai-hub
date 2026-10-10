// bun scripts/check-microgpt.ts
// FastGPT (hand-written backprop) must match microgpt.ts (scalar autograd) step for step.
import { FastGPT } from "../src/lib/microgpt/fast";
import { MicroGPT } from "../src/lib/microgpt/microgpt";

const text = "emma\nolivia\nava\nisabella\nsophia\ncharlotte\nmia\namelia\nharper\nevelyn\nabigail\nemily\nella\nelizabeth\ncamila\nluna\nsofia\navery\nmila\naria";
const opts = { nEmbd: 8, nHead: 2, nLayer: 2, blockSize: 8, learningRate: 0.01, numSteps: 100, seed: 7 };

const slow = new MicroGPT(opts);
slow.loadData(text); slow.initParams();
const fast = new FastGPT({ ...opts, batchSize: 1 });
fast.loadData(text); fast.initParams();

let worst = 0;
for (let s = 0; s < 3; s++) {
  const a = slow.trainStep(), b = fast.trainStep();
  if (Math.abs(a.loss - b.loss) > 1e-6) throw new Error(`step ${s}: loss ${a.loss} vs ${b.loss}`);
  for (const k of fast.names) {
    const flat = (slow.stateDict[k] as { data: number }[][]).flat().map((p) => p.data);
    const w = fast.W[k].data;
    flat.forEach((x, i) => { worst = Math.max(worst, Math.abs(x - w[i])); });
  }
}
if (worst > 1e-6) throw new Error(`weights diverged by ${worst}`);
console.log(`parity ok (3 steps, max weight diff ${worst.toExponential(1)})`);

// it actually learns
const m = new FastGPT({ nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 12, learningRate: 0.01, numSteps: 300, batchSize: 4 });
m.loadData(text); m.initParams();
const start = m.trainStep().loss;
let end = start;
for (let i = 0; i < 299; i++) end = m.trainStep().loss;
if (!(end < start * 0.7)) throw new Error(`loss did not drop: ${start} -> ${end}`);
console.log(`learning ok (loss ${start.toFixed(2)} -> ${end.toFixed(2)})`);

// checkpoint round trip
const copy = new FastGPT({ nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 12 });
copy.loadData(text); copy.initParams();
const ok = copy.importWeights({ config: m.config, chars: m.uchars, step: m.step, loss: end, curve: [], weights: m.exportWeights() });
const diff = Math.abs(copy.trace([m.BOS, 1, 2])[2].logits[0] - m.trace([m.BOS, 1, 2])[2].logits[0]);
if (!ok || diff > 1e-4) throw new Error(`checkpoint round trip failed (${ok}, ${diff})`);
console.log("checkpoint ok");
