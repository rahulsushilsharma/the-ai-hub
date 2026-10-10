import { MicroGPT } from "@/lib/microgpt/microgpt";

let model: MicroGPT | null = null;
let stopping = false;
let training = false;
let gen = 0; // bumped on init so an abandoned training loop exits and stays silent

const post = (type: string, payload?: unknown) => self.postMessage({ type, payload });
const sample = (m: MicroGPT, n: number, temperature: number): string[] =>
  Array.from({ length: n }, () => m.generate(temperature).text);

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === "init") {
    gen++;
    training = false;
    const m = (model = new MicroGPT(payload.options));
    m.loadData(payload.text);
    const info = m.initParams();
    post("ready", { ...info, chars: m.uchars, config: m.getConfig() });
    post("checkpoint", { step: 0, samples: sample(m, 6, 0.8) });
  } else if (type === "train" && model && !training) {
    const m = model;
    const g = gen;
    training = true;
    stopping = false;
    m.learningRate = payload.lr;
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
  } else if (type === "inspect" && model) {
    post("inspect", { id: payload.id, rows: model.inspect(payload.tokens) });
  } else if (type === "embeddings" && model) {
    post("embeddings", model.getEmbeddings());
  } else if (type === "generate" && model) {
    post("samples", sample(model, payload.count, payload.temperature));
  }
};
