import {
  AutoProcessor,
  AutoTokenizer,
  ImageSegmentationPipeline,
  LlavaOnevisionForConditionalGeneration,
  pipeline,
  RawImage,
  type ProgressCallback,
} from "@huggingface/transformers";

class BgRemoverPipeline {
  static task: "image-segmentation";

  static instance: ImageSegmentationPipeline | null = null;

  static async getInstance(progress_callback?: ProgressCallback) {
    if (!this.instance) {
      try {
        this.instance = (await pipeline(
          "background-removal",
          "briaai/RMBG-1.4",
          {
            progress_callback,
            dtype: "fp16",
          }
        )) as unknown as ImageSegmentationPipeline;
      } catch (error) {
        console.log(error);
        this.instance = (await pipeline(this.task, "briaai/RMBG-1.4", {
          progress_callback,
          device: "auto",
        })) as unknown as ImageSegmentationPipeline;
      }
    }

    return this.instance;
  }
}
self.addEventListener("message", async (event) => {
  const bgRemover = await BgRemoverPipeline.getInstance((x) => {
    self.postMessage(x);
    console.log(x);
  });

  if (bgRemover === undefined) {
    self.postMessage({ status: "complete", output: "LLM not loaded" });
    return;
  }

  switch (event.data.type) {
    case "image": {
      const output1 = await bgRemover(event.data.image, {});
      console.log(output1);
      self.postMessage({
        status: "complete",
        output: output1[0],
      });
    }
  }
});

// Load tokenizer, processor and model
const model_id = "llava-hf/llava-onevision-qwen2-0.5b-ov-hf";

const tokenizer = await AutoTokenizer.from_pretrained(model_id);
const processor = await AutoProcessor.from_pretrained(model_id);
processor.config.num_additional_image_tokens = 1;
const model = await LlavaOnevisionForConditionalGeneration.from_pretrained(
  model_id,
  {
    dtype: {
      embed_tokens: "fp16", // or 'fp32' or 'q8'
      vision_encoder: "fp16", // or 'fp32' or 'q8'
      decoder_model_merged: "q4", // or 'q8'
    },
    // device: 'webgpu',
  }
);

// Prepare text inputs
const prompt = "What does the text say?";
const messages = [
  { role: "system", content: "Answer the question." },
  { role: "user", content: `<image>\n${prompt}` },
];
const text = tokenizer.apply_chat_template(messages, {
  tokenize: false,
  add_generation_prompt: true,
});
const text_inputs = tokenizer(text);

// Prepare vision inputs
const url =
  "https://huggingface.co/qnguyen3/nanoLLaVA/resolve/main/example_1.png";
const image = await RawImage.fromURL(url);
const vision_inputs = await processor(image);

// Generate response
const { past_key_values, sequences } = await model.generate({
  ...text_inputs,
  ...vision_inputs,
  do_sample: false,
  max_new_tokens: 64,
  return_dict_in_generate: true,
});

// Decode output
const answer = tokenizer.decode(
  sequences.slice(0, [text_inputs.input_ids.dims[1], null]),
  { skip_special_tokens: true }
);
console.log(answer);
// The text says "small but mighty" in a playful font.

const new_messages = [
  ...messages,
  { role: "assistant", content: answer },
  {
    role: "user",
    content: "How does the text correlate to the context of the image?",
  },
];
const new_text = tokenizer.apply_chat_template(new_messages, {
  tokenize: false,
  add_generation_prompt: true,
});
const new_text_inputs = tokenizer(new_text);

// Generate another response
const output = await model.generate({
  ...new_text_inputs,
  past_key_values,
  do_sample: false,
  max_new_tokens: 256,
});
const new_answer = tokenizer.decode(
  output.slice(0, [new_text_inputs.input_ids.dims[1], null]),
  { skip_special_tokens: true }
);
console.log(new_answer);
