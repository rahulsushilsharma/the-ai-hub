import { FastGPT, type Checkpoint } from "@/lib/microgpt/fast";

let model: FastGPT | null = null;
let base: FastGPT | null = null; // untrained twin (same seed, same init) for step-0 comparisons
let stopping = false;
let training = false;
let gen = 0; // bumped on init so an abandoned training loop exits and stays silent

const post = (type: string, payload?: unknown) => self.postMessage({ type, payload });
const sample = (m: FastGPT, n: number, temperature: number): string[] =>
  Array.from({ length: n }, () => m.generate(temperature).text);

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === "init") {
    gen++;
    training = false;
    const m = (model = new FastGPT(payload.options));
    m.loadData(payload.text);
    const info = m.initParams();
    base = new FastGPT(payload.options);
    base.loadData(payload.text);
    base.initParams();
    // a matching checkpoint makes the lab open on a model that has already learned
    const ck = payload.pretrained as Checkpoint | undefined;
    const pre = ck && m.importWeights(ck) ? { step: ck.step, loss: ck.loss, curve: ck.curve } : null;
    post("ready", { ...info, chars: m.uchars, config: m.getConfig(), pretrained: pre });
    post("checkpoint", { step: m.step, samples: sample(m, 6, 0.8) });
  } else if (type === "train" && model && !training) {
    const m = model;
    const g = gen;
    training = true;
    stopping = false;
    m.learningRate = payload.lr;
    m.batchSize = payload.batchSize ?? 1;
    // LR decays linearly over this batch only, so repeated runs never go negative.
    m.numSteps = m.step + payload.steps;
    let batch: { step: number; loss: number }[] = [];
    for (let i = 0; i < payload.steps && !stopping && g === gen; i++) {
      const r = m.trainStep();
      batch.push({ step: r.step, loss: r.loss });
      const last = i === payload.steps - 1 || stopping;
      if (batch.length >= 5 || last) {
        post("steps", {
          batch,
          last: { step: r.step, loss: r.loss, lr: r.learningRate, doc: r.doc, tokens: r.tokens, posLosses: r.posLosses },
        });
        batch = [];
        await new Promise((res) => setTimeout(res, 0)); // let stop / inspect messages through
      }
      if (r.step % payload.checkpointEvery === 0) post("checkpoint", { step: r.step, samples: sample(m, 6, 0.8) });
    }
    if (g === gen) {
      if (batch.length) post("steps", { batch, last: null });
      training = false;
      post("done", { step: m.step });
    }
  } else if (type === "stop") {
    stopping = true;
  } else if (type === "trace" && model) {
    post("trace", { id: payload.id, rows: (payload.baseline && base ? base : model).trace(payload.tokens) });
  } else if (type === "embeddings" && model) {
    post("embeddings", (payload?.baseline && base ? base : model).getEmbeddings());
  } else if (type === "generate" && model) {
    post("samples", sample(payload.baseline && base ? base : model, payload.count, payload.temperature));
  }
};
