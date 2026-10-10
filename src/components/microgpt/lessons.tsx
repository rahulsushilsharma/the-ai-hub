import type { ArchCfg } from "./viz";

/* ---------- textbook pages ---------- */

export type Zone = "input" | "tok" | "pos" | "sum" | "attn" | "mlp" | "out" | "detail" | "panel";
export type Lesson = {
  title: string;
  zones: Zone[]; // parts of the map to keep lit; everything else dims. Empty = nothing dimmed.
  scroll: "input" | "map" | "detail" | "panel";
  open?: "emb" | "attn" | "mlp" | "out"; // block to open in place
  spot?: number; // numbered attention section to emphasise
  flow?: boolean; // replay the flow animation on entry
  body: (a: ArchCfg) => React.ReactNode;
};


export const LESSONS: Lesson[] = [
  {
    title: "A GPT guesses the next letter", zones: [], scroll: "map", flow: true,
    body: (a) => <>
      <p>That is the whole job. Give it the letters so far and it scores every letter that could come next. Pick one, add it to the end, and ask again. Repeat until it picks ⏎, which means “the name ends here”.</p>
      <p>ChatGPT runs the same loop with word pieces instead of letters. This one is tiny: {a.nLayer} layer{a.nLayer > 1 ? "s" : ""}, {a.nHead} attention head{a.nHead > 1 ? "s" : ""}, {a.nEmbd} numbers per letter.</p>
      <p>In the map, each row is one letter of your input moving left to right through the model.</p>
    </>,
  },
  {
    title: "Letters become numbers", zones: ["input", "tok", "pos", "sum"], scroll: "detail", open: "emb",
    body: (a) => <>
      <p>A model can only do arithmetic, so each letter gets an id, and the id picks a learned list of {a.nEmbd} numbers. This list is the letter’s <b>embedding</b>.</p>
      <p>A second list says <b>where</b> the letter sits: first, second, third. The two are added together. Without the position part, “am” and “ma” would look identical to the model.</p>
    </>,
  },
  {
    title: "Attention: each letter looks back", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 1,
    body: () => <>
      <p>Attention is the only place where letters share information. Each letter makes three lists of numbers:</p>
      <p><b>Query</b>: what I am looking for. <b>Key</b>: what I can offer. <b>Value</b>: what I hand over if picked.</p>
      <p>It is like a search engine. The query is your search, the keys are page titles, and the values are the pages themselves.</p>
    </>,
  },
  {
    title: "Who looks at whom", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 2,
    body: () => <>
      <p><b>① Match.</b> Every query is compared with every key. A good match gives a high score.</p>
      <p><b>② Hide the future.</b> A letter may not look at letters after it, because when writing they do not exist yet.</p>
      <p><b>③ To percentages.</b> Each row of scores becomes percentages that add up to 100% (this step is called softmax).</p>
      <p>Hover a dot to see the same pair light up in every panel.</p>
    </>,
  },
  {
    title: "Blending what was found", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 3,
    body: () => <>
      <p>Each letter now builds a new list of numbers from the values of the letters it looked at. The more attention a letter paid, the more of that value goes into the blend.</p>
      <p>Click a letter in the matrix to see its own recipe.</p>
    </>,
  },
  {
    title: "Several heads at once", zones: ["attn", "detail"], scroll: "detail", open: "attn", spot: 4,
    body: (a) => <>
      <p>{a.nHead > 1 ? `${a.nHead} heads do this side by side, each free to learn its own habit. One might track vowels, another the first letter.` : "This model has one head. Bigger models run many side by side, each learning its own habit."} Use ‹ › next to Attention to switch heads.</p>
      <p>The results are joined and then <b>added back</b> to what came in. This shortcut is called a residual connection. It means each step only has to add something new, never rebuild everything.</p>
    </>,
  },
  {
    title: "The MLP: each letter thinks alone", zones: ["mlp", "detail"], scroll: "detail", open: "mlp",
    body: (a) => <>
      <p>Attention moved information <i>between</i> letters. Now each letter is processed <i>on its own</i> by a small network of {4 * a.nEmbd} neurons.</p>
      <p>Each neuron either fires (above the line) or stays off (below). The off ones are cut to zero; this is called ReLU. Which neurons fire is a pattern the model learned during training.</p>
    </>,
  },
  {
    title: "Stacking blocks", zones: ["attn", "mlp"], scroll: "map",
    body: (a) => <>
      <p>Attention followed by an MLP makes one <b>block</b>. {a.nLayer > 1 ? `This model stacks ${a.nLayer}, so the second block reads what the first one wrote.` : "This model has one; real models stack dozens."} GPT-3 stacks 96.</p>
      <p>Before every step the numbers are rescaled to a steady size (RMSNorm), so they cannot drift and blow up as blocks pile on.</p>
    </>,
  },
  {
    title: "From numbers to a guess", zones: ["out", "panel"], scroll: "detail", open: "out",
    body: (a) => <>
      <p>The last list of {a.nEmbd} numbers is turned into <b>one score per possible letter</b>. These raw scores are called logits.</p>
      <p>Softmax turns the scores into chances that add up to 100%. The bars in the Output block show the five likeliest.</p>
    </>,
  },
  {
    title: "Choosing a letter", zones: ["out", "panel"], scroll: "detail", open: "out",
    body: () => <>
      <p>The model does not always take the favourite. It draws at random, weighted by the chances. That is why it can write a new name every time.</p>
      <p><b>Temperature</b> controls how adventurous it is. Low means safe and repetitive; high means surprising and often wrong. <b>Top-k</b> and <b>top-p</b> remove the unlikely tail before the draw.</p>
      <p>Press <b>Spin</b> here, or <b>Generate next letter</b> at the top, and watch the new letter flow through.</p>
    </>,
  },
  {
    title: "Where the numbers come from", zones: [], scroll: "map",
    body: () => <>
      <p>None of these numbers were written by hand. They started random and were nudged, step after step, to make the real next letter in 32,000 names a little more likely. That process is <b>training</b>.</p>
      <p>Switch the view to <b>Untrained</b> to see the same model before it learned anything, or open the Train tab to teach one yourself.</p>
    </>,
  },
];
