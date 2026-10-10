"""Convert Microsoft's pretrained roneneldan/TinyStories-3M (GPT-Neo) to the browser format read by src/lib/microgpt/story.ts.

python scripts/tinystories/convert.py      (CPU, ~1 min, needs torch + transformers)

GPT-Neo is GPT-2 with two differences, folded into the weights so the browser runs plain GPT-2 maths:
  - attention scores are not divided by sqrt(head_dim)  -> q weights are multiplied by sqrt(head_dim)
  - q/k/v have no bias                                   -> zero biases
Local attention (window 256) equals global attention while the context is capped at 256 tokens.
Writes public/microgpt/tinystories/{model.bin, meta.json, tokenizer.json, stories.json} and scripts/tinystories/golden.json.
"""
import json, math, os, random, sys, urllib.request
sys.modules["sklearn"] = None  # transformers imports it when installed; not needed here (and blocked on some Windows setups)
import torch
from transformers import AutoTokenizer, GPTNeoForCausalLM

REPO = "roneneldan/TinyStories-3M"
CTX = 256
OUT = "public/microgpt/tinystories"
os.makedirs(OUT, exist_ok=True)

model = GPTNeoForCausalLM.from_pretrained(REPO, attn_implementation="eager").eval()
tok = AutoTokenizer.from_pretrained(REPO)
c = model.config
C, H = c.hidden_size, c.num_heads
assert c.window_size >= CTX
cfg = dict(vocab=c.vocab_size, ctx=CTX, n_layer=c.num_layers, n_embd=C, n_head=H)

# round to fp16 first, so golden.json is computed from exactly the numbers the browser gets
with torch.no_grad():
    for w in model.parameters():
        w.copy_(w.half().float())

t = model.transformer
tensors = [("wte", t.wte.weight), ("wpe", t.wpe.weight[:CTX])]
for i, b in enumerate(t.h):
    a = b.attn.attention
    qkv = torch.cat([a.q_proj.weight * math.sqrt(C // H), a.k_proj.weight, a.v_proj.weight])
    tensors += [(f"h{i}.{n}", w) for n, w in [
        ("ln1.w", b.ln_1.weight), ("ln1.b", b.ln_1.bias), ("qkv.w", qkv), ("qkv.b", torch.zeros(3 * C)),
        ("proj.w", a.out_proj.weight), ("proj.b", a.out_proj.bias), ("ln2.w", b.ln_2.weight), ("ln2.b", b.ln_2.bias),
        ("fc.w", b.mlp.c_fc.weight), ("fc.b", b.mlp.c_fc.bias), ("fc2.w", b.mlp.c_proj.weight), ("fc2.b", b.mlp.c_proj.bias)]]
tensors += [("lnf.w", t.ln_f.weight), ("lnf.b", t.ln_f.bias)]

table, off = [], 0
with open(f"{OUT}/model.bin", "wb") as f:
    for n, w in tensors:
        h = w.detach().half()
        f.write(h.numpy().tobytes())
        table.append({"name": n, "shape": list(h.shape), "offset": off})
        off += h.numel()

# reference output from Hugging Face's own GPT-Neo implementation
prompt = "Once upon a time, there was a little"
ids = [tok.eos_token_id] + tok(prompt)["input_ids"]
with torch.no_grad():
    out = model(torch.tensor([ids]), output_attentions=True)
json.dump({"prompt": prompt, "ids": ids, "logits": [round(v, 5) for v in out.logits[0, -1].tolist()],
           "attn_l0_h0": [round(v, 6) for v in out.attentions[0][0, 0, -1].tolist()]}, open("scripts/tinystories/golden.json", "w"))

tok.backend_tokenizer.save(f"{OUT}/tokenizer.json")

# a sample of the stories it was trained on (TinyStories, the original GPT-3.5/GPT-4 version)
url = "https://huggingface.co/datasets/roneneldan/TinyStories/resolve/main/TinyStories-valid.txt"
req = urllib.request.Request(url, headers={"Range": "bytes=0-2000000"})
text = urllib.request.urlopen(req).read().decode("utf-8", "ignore")
stories = [s.strip() for s in text.split("<|endoftext|>")][1:-1]  # first and last are cut by the range
json.dump(random.Random(1).sample(stories, 300), open(f"{OUT}/stories.json", "w"))

json.dump({
    "config": cfg, "params": sum(w.numel() for w in model.parameters()), "eot": tok.eos_token_id, "tensors": table,
    "source": {"repo": REPO, "url": f"https://huggingface.co/{REPO}", "paper": "https://arxiv.org/abs/2305.07759",
               "stories": 2_119_719, "arch": "GPT-Neo"},
    "prompts": ["Once upon a time", "Lily wanted to", "The little dog", "One day, Tom"],
}, open(f"{OUT}/meta.json", "w"))

print(f"{REPO}: {off * 2 / 1e6:.1f} MB fp16, {len(table)} tensors")
print(tok.decode(model.generate(torch.tensor([ids]), max_new_tokens=60, do_sample=False)[0][1:]))
