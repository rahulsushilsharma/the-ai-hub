import {
  pipeline,
  TextGenerationPipeline,
  TextStreamer,
  type PipelineType,
  type ProgressCallback,
} from "@huggingface/transformers";

class LLMCompletionPipeline {
  static task: PipelineType = "text-generation";
  static model = "onnx-community/SmolLM2-135M-Instruct-ONNX-GQA";
  static instance: unknown;

  static async getInstance(progress_callback: ProgressCallback) {
    if (!this.instance) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
        device: "webgpu",
      });
    }

    return this.instance as TextGenerationPipeline;
  }
}
self.addEventListener("message", async (event) => {
  const llm = await LLMCompletionPipeline.getInstance((x) => {
    self.postMessage(x);
  });

  if (llm === undefined) {
    self.postMessage({ status: "complete", output: "LLM not loaded" });
    return;
  }

  switch (event.data.type) {
    case "chat:message": {
      const output1 = await llm(event.data.messages, {
        max_new_tokens: 512,
        do_sample: false,
        streamer: new TextStreamer(llm.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (text) => {
            self.postMessage({ status: "update", output: text });
          },
        }),
      });

      console.log(output1);
      self.postMessage({
        status: "complete",
        output: output1[0].generated_text,
      });
    }
  }
});
