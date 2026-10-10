// bun scripts/train-microgpt.ts [steps]
// Trains the default microGPT preset on names and writes public/microgpt/pretrained-names.json,
// which the lab loads so the Explain tab opens on a model that has learned something.
import { FastGPT, type Checkpoint } from "../src/lib/microgpt/fast";

const STEPS = Number(process.argv[2] ?? 4000);
const config = { nEmbd: 32, nHead: 4, nLayer: 2, blockSize: 16 }; // keep in sync with PRESETS[0] in src/pages/Microgpt.tsx
const text = await Bun.file("public/microgpt/names.txt").text();

const m = new FastGPT({ ...config, learningRate: 0.01, numSteps: STEPS, batchSize: 16, seed: 42 });
m.loadData(text);
m.initParams();

const curve: { step: number; loss: number }[] = [];
const every = Math.max(1, Math.floor(STEPS / 200));
let acc = 0, n = 0, last = 0;
const t0 = performance.now();
for (let i = 0; i < STEPS; i++) {
  const r = m.trainStep();
  acc += r.loss; n++;
  if (r.step % every === 0) {
    last = acc / n;
    curve.push({ step: r.step, loss: +last.toFixed(4) });
    acc = 0; n = 0;
  }
  if (r.step % 500 === 0) console.log(`step ${r.step}  loss ${last.toFixed(3)}  ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}

const ck: Checkpoint = { config, chars: m.uchars, step: m.step, loss: +last.toFixed(4), curve, weights: m.exportWeights() };
await Bun.write("public/microgpt/pretrained-names.json", JSON.stringify(ck));
console.log(`params ${m.numParams()}  final loss ${last.toFixed(3)}`);
console.log("samples:", Array.from({ length: 12 }, () => m.generate(0.8).text).join(", "));
