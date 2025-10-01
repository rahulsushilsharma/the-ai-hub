import { pipeline, TextStreamer } from "@huggingface/transformers";

class LLMCompletionPipeline {
  static task = "text-generation";
  static model = "onnx-community/LFM2-350M-Math-ONNX";
  /**
   * @type {import("@huggingface/transformers").Pipeline|null}
   */
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
        device: "webgpu",
      });
    }

    return this.instance;
  }
}
self.addEventListener("message", async (event) => {
  // Retrieve the translation pipeline. When called for the first time,
  // this will load the pipeline and save it for future use.
  const llm = await LLMCompletionPipeline.getInstance((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  });

  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Write a poem about machine learning." },
  ];

  // Generate a response
  const output1 = await llm(messages, {
    max_new_tokens: 512,
    do_sample: false,
    streamer: new TextStreamer(llm.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      // callback_function: (text) => { /* Optional callback function */ },
    }),
  });
  console.log(output1[0].generated_text.at(-1).content);
  // If the input text is empty, return an empty string
  self.postMessage({
    status: "complete",
    output: output1[0].generated_text.at(-1).content,
  });
});
