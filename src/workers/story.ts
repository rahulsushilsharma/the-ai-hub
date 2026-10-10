import { Tokenizer } from "@huggingface/tokenizers";
import { StoryGPT, softmax, topK, type LayerFlow, type StoryMeta } from "@/lib/microgpt/story";

/** One token of the text, and how likely the model thought it was just before it appeared. */
export type Entry = {
  id: number; text: string; prompt: boolean;
  p: number;                                   // probability the model gave this token
  top: { text: string; p: number }[];          // the 10 tokens it considered most likely here
};
/** The details behind one entry, sent only when it is clicked. */
export type Inspect = {
  index: number;
  lens: { text: string; p: number }[][];       // its top 3 guesses after each layer (logit lens)
  attn: Float32Array[][];                      // [layer][head][earlier position], position 0 is the start token
  x0: Float32Array;                            // token + position embedding, where the residual stream starts
  flow: LayerFlow[];                           // what each block added, and the stream after it
};

let trained: StoryGPT | null = null;
let untrained: StoryGPT | null = null;
let tok: Tokenizer | null = null;
let run = 0;
// what the last run computed before each entry; the logit lens over a 50k vocabulary is too slow to do for every token
let last: { m: StoryGPT; x0: Float32Array; attn: Float32Array[][]; flow: LayerFlow[] }[] = [];

const post = (type: string, payload?: unknown) => self.postMessage({ type, payload });
const word = (id: number) => tok!.decode([id]);

self.onmessage = async ({ data: { type, payload } }) => {
  if (type === "load") {
    const get = (f: string) => fetch(`${payload.base}/${f}`).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r; });
    try {
      const [meta, buf, tj, stories] = await Promise.all([
        get("meta.json").then((r) => r.json() as Promise<StoryMeta>), get("model.bin").then((r) => r.arrayBuffer()),
        get("tokenizer.json").then((r) => r.json()), get("stories.json").then((r) => r.json()),
      ]);
      trained = new StoryGPT(meta, buf);
      untrained = null;
      tok = new Tokenizer(tj, {});
      post("ready", { meta, stories });
    } catch (e) {
      post("error", String(e));
    }
  } else if (type === "tokenize" && tok) {
    post("tokens", tok.encode(payload.text).ids.map((id) => ({ id, text: word(id) })));
  } else if (type === "stop") {
    run = 0;
  } else if (type === "inspect" && last[payload.index]) {
    const { m, x0, attn, flow } = last[payload.index];
    const lens = flow.map((f) => {
      const lp = softmax(m.head(f.resid));
      return topK(lp, 3).map((j) => ({ text: word(j), p: lp[j] }));
    });
    post("inspect", { index: payload.index, lens, attn, x0, flow } satisfies Inspect);
  } else if (type === "generate" && trained && tok) {
    const my = (run = payload.run); // a newer generate or a stop ends this loop
    const m = payload.untrained ? (untrained ??= new StoryGPT(trained.meta, undefined, 7)) : trained;
    const { eot } = m.meta, { ctx } = m.c;
    const prompt = tok.encode(payload.prompt).ids;
    const kv = m.newKV();
    last = [];
    let cur = eot;
    for (let i = 0; i < Math.min(ctx - 1, prompt.length + payload.max); i++) {
      const out = m.step(kv, cur, true);
      const probs = softmax(out.logits);
      const fromPrompt = i < prompt.length;
      let next: number;
      if (fromPrompt) next = prompt[i];
      else {
        const k = topK(out.logits, payload.topK);
        const q = softmax(Float32Array.from(k, (j) => out.logits[j]), payload.temp);
        let r = Math.random();
        next = k[k.length - 1];
        for (let j = 0; j < k.length; j++) if ((r -= q[j]) <= 0) { next = k[j]; break; }
        if (next === eot) break;
      }
      last.push({ m, x0: out.x0!, attn: out.attn!, flow: out.flow! });
      const e: Entry = { id: next, text: word(next), prompt: fromPrompt, p: probs[next], top: topK(probs, 10).map((j) => ({ text: word(j), p: probs[j] })) };
      post("entry", { run: my, entry: e });
      cur = next;
      await new Promise((r) => setTimeout(r, 0)); // let "stop" through
      if (run !== my) return;
    }
    post("done", { run: my });
  }
};
