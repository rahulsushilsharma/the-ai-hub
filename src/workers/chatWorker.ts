import {
  pipeline,
  TextGenerationPipeline,
  TextStreamer,
} from "@huggingface/transformers";

let llmPipeline: TextGenerationPipeline | null = null;
self.addEventListener("message", async (event) => {
  const { type, params, messages } = event.data;

  if (type === "init") {
    // Avoid creating an overly complex union type from pipeline(...) by narrowing via unknown
    const raw = (await pipeline("text-generation", params.value, {
      device: params.device,
      progress_callback: (x) => {
        console.log("llm ", x);
        self.postMessage(x);
      },
    })) as unknown;
    llmPipeline = raw as TextGenerationPipeline;
  }

  if (llmPipeline === null) {
    self.postMessage({ status: "complete", output: "LLM not loaded" });
    return;
  }

  switch (event.data.type) {
    case "chat:message": {
      const output1 = await llmPipeline(messages, {
        max_new_tokens: params.max_new_tokens,
        do_sample: false,
        streamer: new TextStreamer(llmPipeline.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (text) => {
            self.postMessage({ status: "stream", output: text });
          },
        }),
      });

      self.postMessage({
        status: "complete",
        output: output1[0],
      });
    }
  }
});
