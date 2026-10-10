// bun scripts/check-story.ts
// The browser engine (src/lib/microgpt/story.ts) must give the same logits as Hugging Face's GPT-Neo
// (scripts/tinystories/golden.json from convert.py), and tokenizer.json must split text the same way.
import { Tokenizer } from "@huggingface/tokenizers";
import { StoryGPT, type StoryMeta } from "../src/lib/microgpt/story";

const dir = "public/microgpt/tinystories";
const meta: StoryMeta = await Bun.file(`${dir}/meta.json`).json();
const golden = await Bun.file("scripts/tinystories/golden.json").json();
const m = new StoryGPT(meta, await Bun.file(`${dir}/model.bin`).arrayBuffer());

const tok = new Tokenizer(await Bun.file(`${dir}/tokenizer.json`).json(), {});
const ids = [meta.eot, ...tok.encode(golden.prompt).ids];
if (ids.join() !== golden.ids.join()) throw new Error(`tokenizer mismatch:\n js ${ids}\n py ${golden.ids}`);
console.log(`tokenizer ok (${ids.length} tokens)`);

const kv = m.newKV();
let out = m.step(kv, ids[0], true);
const t0 = performance.now();
for (const t of ids.slice(1)) out = m.step(kv, t, true);
const ms = (performance.now() - t0) / (ids.length - 1);

let worst = 0;
out.logits.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - golden.logits[i])); });
if (worst > 1e-2) throw new Error(`logits differ by ${worst}`);
let aw = 0;
out.attn![0][0].forEach((v, i) => { aw = Math.max(aw, Math.abs(v - golden.attn_l0_h0[i])); });
if (aw > 1e-3) throw new Error(`layer 0 attention differs by ${aw}`);
console.log(`parity ok (max logit diff ${worst.toExponential(1)}, attention ${aw.toExponential(1)}, ${ms.toFixed(1)} ms/token)`);
