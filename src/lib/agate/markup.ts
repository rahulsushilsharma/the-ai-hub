export default `<div class="page">
  <section class="card versions" aria-labelledby="ver-label">
    <div class="card-head">
      <h2 class="h" id="ver-label">Model</h2>
      <span class="meta"><span id="mast-version">Preview 003</span> · <span id="mast-spec">0.26B · text-to-image · 512 px</span></span>
    </div>
    <div class="seg" role="radiogroup" aria-labelledby="ver-label" id="versions"></div>
    <p class="ver-note" id="ver-note"></p>
    <p class="hint">A 0.19B-parameter flow model with a 68M text encoder, running on your own GPU through WebGPU.
      First visit downloads the chosen model once (<span id="dl-size">about 530&nbsp;MB</span>); after that it loads from the browser cache.</p>
  </section>

  <div id="nogpu" class="notice" role="alert" hidden>
    <strong>WebGPU unavailable</strong>
    <p id="nogpu-why"></p>
    <p>Agate needs WebGPU for usable speed: use a recent Chrome or Edge (113+) on Windows, macOS or ChromeOS,
      or Chrome on Android 121+; on Linux and in Firefox/Safari WebGPU may have to be enabled in the browser's flags.
      You can still run it on the CPU (WebAssembly) — correct, but several minutes per image (far longer at 512 px).</p>
    <button id="use-wasm" class="btn ghost" type="button">Run on CPU instead</button>
  </div>

  <main class="grid">
    <section class="card controls">
      <label class="lbl" for="prompt">Prompt</label>
      <textarea id="prompt" name="prompt" rows="3" spellcheck="false" autocomplete="off">a green teapot and a red cup on a table</textarea>
      <div class="examples" id="examples">
        <span class="dim">Try</span>
      </div>
      <label class="lbl" for="negative">Avoid <span class="dim" id="neg-hint">(optional negative prompt)</span></label>
      <input id="negative" name="negative" type="text" spellcheck="false" autocomplete="off" placeholder="e.g. text, blur…">

      <div class="row">
        <div class="field">
          <label class="lbl" for="seed">Seed</label>
          <div class="seed-row">
            <input id="seed" name="seed" inputmode="numeric" autocomplete="off" type="number" min="0" max="4294967295" step="1" value="0">
            <button id="dice" class="btn icon" type="button" title="Random seed" aria-label="Random seed"><span aria-hidden="true">⟳</span></button>
          </div>
        </div>
        <div class="field">
          <label class="lbl" for="steps">Steps <b id="steps-v">50</b></label>
          <input id="steps" type="range" min="4" max="50" step="1" value="50">
          <label class="toggle fast" title="25 steps: about twice as fast; detail holds, the layout can change" aria-describedby="fast-hint"><input type="checkbox" id="fast"> Fast (25&nbsp;steps)</label>
          <span id="fast-hint" class="sr-only">About twice as fast; detail holds, the layout can change.</span>
        </div>
        <div class="field">
          <label class="lbl" for="cfg">CFG <b id="cfg-v">3.0</b></label>
          <input id="cfg" type="range" min="1" max="8" step="0.5" value="3">
        </div>
      </div>
      <div class="row res-row" id="res-row" hidden>
        <div class="field">
          <span class="lbl" id="res-label">Resolution</span>
          <div class="seg small" role="radiogroup" aria-labelledby="res-label" id="res"></div>
        </div>
      </div>

      <button id="go" class="btn primary" type="button" disabled>Load model</button>

      <div class="progress">
        <span id="announce" class="sr-only" role="status" aria-live="polite"></span>
        <div class="bar"><div id="bar-fill"></div></div>
        <div class="progress-text"><span id="status">Idle</span><span id="status-r" class="dim"></span></div>
      </div>
      <p class="prepared" id="prepared" hidden></p>
    </section>

    <section class="card output">
      <div class="out-head">
        <h2 class="h" id="out-label">Output · 512 × 512</h2>
        <span class="toggles">
          <label class="toggle" title="Show the thinker's 16 × 16 plan and the expected final image at every step"><input type="checkbox" id="show-thinker" checked> Show thinker</label>
          <label class="toggle"><input type="checkbox" id="crisp"> Crisp pixels</label>
        </span>
      </div>
      <div class="frame" id="frame">
        <canvas id="canvas" width="512" height="512" role="img" aria-label="Generated image"></canvas>
        <div class="placeholder" id="placeholder">
          <img src="/agate/agate-a.svg" alt="">
        </div>
      </div>
      <div class="thinker" id="thinker" hidden>
        <figure><canvas id="plan-canvas" width="16" height="16" role="img" aria-label="Thinker plan, 16 by 16 grid"></canvas>
          <figcaption class="dim">Thinker plan · 16 × 16</figcaption></figure>
        <figure><canvas id="pred-canvas" width="32" height="32" role="img" aria-label="Expected final image at the current step"></canvas>
          <figcaption class="dim">Expected · <span id="thinker-step">0 / 0</span></figcaption></figure>
        <p class="thinker-note">The thinker lays the picture out on a 16 × 16 grid before the renderer paints it.
          Colours are the plan's three main directions (fixed at the first step, as in the ComfyUI nodes); the
          expected image is x₁ = z + (1 − t)·v, shown with the SD latent→RGB approximation.</p>
      </div>
      <p class="ai-note" id="ai-note" hidden><span><strong>AI-generated image.</strong>
        Made by <span id="ai-model">Agate Preview 003</span>; it carries an invisible watermark and, when saved, PNG provenance metadata (no prompt).</span></p>
      <div class="out-foot">
        <dl class="timings" id="timings"></dl>
        <a id="save" class="btn ghost small" download="agate.png" aria-label="Save generated image as PNG" hidden>Save PNG</a>
      </div>
    </section>
  </main>

  <div id="parity" class="notice" role="status" hidden></div>

  <footer class="foot">
    <p class="strong">Runs entirely in your browser on WebGPU — nothing leaves your machine.</p>
    <p>Every image made here is marked as AI-generated (EU AI Act Art. 50): an invisible watermark in the
      pixels (invisible-watermark “dwtDctSvd”, payload AGATE + release) and, in the saved PNG, text fields
      <code>ai_generated</code>, <code>generator</code>, <code>model</code>. Neither survives every edit; please label AI images you publish.</p>
    <p>Why Agate: LogoLabs' search for the best small-scale image architecture, as groundwork for glyph and symbol generation and vector-native fonts to go with our wordmarks. General image generation served as a benchmark-friendly proxy for those tasks (unlike, e.g., SDF generation); next it feeds SVG generation with Inkvec. Released to share these architectural efforts.</p>
    <p class="credit">
      <img src="/agate/logolabs-mark.svg" alt="" width="14" height="19">
      <a href="https://logolabs.org" target="_blank" rel="noopener">logolabs.org</a> ·
      <a href="https://huggingface.co/Logolabs" target="_blank" rel="noopener">huggingface.co/Logolabs</a> ·
      MIT licence · <span id="backend">backend: —</span>
    </p>
  </footer>
</div>
`;
