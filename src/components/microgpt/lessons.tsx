import type { ArchCfg } from "./viz";

/* ---------- guided tour ---------- */

export type Zone = "input" | "tok" | "pos" | "sum" | "attn" | "mlp" | "out" | "detail" | "panel";
export type Lesson = {
  title: string;
  zones: Zone[]; // parts of the canvas to keep lit; everything else dims. Empty = nothing dimmed.
  scroll: "input" | "map" | "detail" | "panel";
  open?: "attn" | "mlp";
  spot?: number; // numbered attention section to emphasise
  flow?: boolean; // play the data-flow animation on entry
  body: (a: ArchCfg) => React.ReactNode;
};

export const LESSONS: Lesson[] = [
  {
    title: "What is a transformer?", zones: [], scroll: "input", flow: true,
    body: (a) => <>A GPT answers one question over and over: <i>“given the characters so far, what is the most likely next one?”</i> Text
      from ChatGPT is built the same way, one piece at a time. This is a tiny one: {a.nLayer} layer{a.nLayer > 1 ? "s" : ""}, {a.nHead} attention
      head{a.nHead > 1 ? "s" : ""}, {a.nEmbd} numbers per character. Watch the wave: each row is a character flowing through it.</>,
  },
  {
    title: "1 · Characters become tokens", zones: ["input", "tok"], scroll: "input",
    body: () => <>Computers need numbers, so every character gets an id (a <b>token</b>). A special ⏎ token marks the start. The model
      sees the sequence <b>⏎ + your letters</b>, and it predicts what follows at <i>every</i> position at once.</>,
  },
  {
    title: "2 · Embeddings", zones: ["tok", "pos", "sum"], scroll: "map",
    body: (a) => <>Each token id looks up a learned list of <b>{a.nEmbd} numbers</b>, its embedding. A second lookup encodes <b>where</b> it sits in
      the sequence, since attention alone has no sense of order. The two are added and rescaled (RMSNorm). That vector is what enters the
      first block.</>,
  },
  {
    title: "3 · Query, key, value", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 1,
    body: () => <>Self-attention lets characters look at each other. Each vector is turned into three: a <b>query</b> (what I am looking for),
      a <b>key</b> (what I contain) and a <b>value</b> (what I will share). Like searching the web: query = your search text, key = page
      title, value = page content.</>,
  },
  {
    title: "4 · Scores, mask and softmax", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 2,
    body: () => <>Each query is compared with every key. A high score means a good match. The <b>mask</b> forbids looking at later
      characters, because at generation time they do not exist yet. Softmax turns each row into percentages. Hover a cell to see the exact
      arithmetic.</>,
  },
  {
    title: "5 · Mixing values", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 3,
    body: () => <>The new vector for a character is a <b>weighted blend of value vectors</b>: letters it paid more attention to contribute
      more. Click different rows of the matrix to see how each character builds its own mix.</>,
  },
  {
    title: "6 · Heads, output projection, residual", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 4,
    body: (a) => <>{a.nHead} head{a.nHead > 1 ? "s run" : " runs"} in parallel, each free to learn a different habit. Their outputs are joined and
      projected by a learned matrix, then <b>added back to the input</b> (a residual connection), so the original information is never lost.</>,
  },
  {
    title: "7 · The MLP", zones: ["mlp", "detail"], scroll: "detail", open: "mlp",
    body: (a) => <>Attention moved information <i>between</i> characters. The MLP now thinks about each one <i>on its own</i>: widen to {4 * a.nEmbd}
      neurons, switch negatives off with ReLU, narrow back to {a.nEmbd}. The bars show which neurons fire for this character.</>,
  },
  {
    title: "8 · Stacking and stabilising", zones: ["attn", "mlp"], scroll: "map",
    body: (a) => <>Attention + MLP form one <b>block</b>{a.nLayer > 1 ? `; this model stacks ${a.nLayer} of them, each refining the last` : "; real models stack dozens"}.
      Two helpers keep deep stacks trainable: <b>RMSNorm</b> rescales numbers before each step, and <b>residual connections</b> add each
      step’s result onto its input. (Large models also use dropout during training; this one does not.)</>,
  },
  {
    title: "9 · Output scores", zones: ["out", "panel"], scroll: "panel",
    body: (a) => <>The last vector is multiplied by one more matrix to give a <b>score for each possible next character</b> ({a.nEmbd} numbers →
      one per vocabulary entry). Higher means “more likely”. These raw scores are called logits.</>,
  },
  {
    title: "10 · Choosing: temperature, top-k, top-p", zones: ["panel"], scroll: "panel",
    body: () => <><b>Softmax</b> converts scores to probabilities. <b>Temperature</b> sharpens (low) or flattens (high) them. <b>Top-k</b> and
      <b> top-p</b> cut off the unlikely tail before a random pick. Press <b>Spin</b>, then append the character and watch the whole table
      recompute for the next step: that is how text is generated.</>,
  },
  {
    title: "11 · Where do the numbers come from?", zones: [], scroll: "input",
    body: () => <>Every matrix you saw was <b>learned</b>. Right now, if the model is untrained, the weights are random and the picture is
      meaningless. Train it in the Lab, then come back with the same input and compare attention, embeddings and predictions.</>,
  },
];

