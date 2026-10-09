import { CHAT_MODELS } from "@/consts/consts";
import type { ChatSettings, Model } from "@/types/types";
import {
  InterruptableStoppingCriteria,
  pipeline,
  TextGenerationPipeline,
  TextStreamer,
  type ProgressCallback,
} from "@huggingface/transformers";

class LLMCompletionPipeline {
  static task: "text-generation";
  static models: Record<string, Model> = Object.fromEntries(
    CHAT_MODELS.map((m) => [m.value, m])
  );
  static instances: Record<string, TextGenerationPipeline> = {};
  static currentModel = CHAT_MODELS[0].value; // Default: SmolLM2

  static async getInstance(progress_callback?: ProgressCallback) {
    const modelConfig = this.models[this.currentModel];

    if (!modelConfig) {
      throw new Error(`Model config not found for ${this.currentModel}`);
    }

    if (!this.instances[this.currentModel]) {
      this.task = "text-generation";
      this.instances[this.currentModel] = (await pipeline(
        this.task,
        modelConfig.value,
        {
          progress_callback,
          device: modelConfig.device,
          dtype: modelConfig.dtype,
        }
      )) as unknown as TextGenerationPipeline;
    }

    return this.instances[this.currentModel];
  }

  static async switchModel(
    modelValue: string,
    progress_callback?: ProgressCallback
  ) {
    if (this.currentModel === modelValue) return this.instances[modelValue];

    if (!this.models[modelValue]) {
      throw new Error(`Unknown model: ${modelValue}`);
    }

    this.currentModel = modelValue;
    return this.getInstance(progress_callback);
  }

  static getCurrentModel() {
    return this.models[this.currentModel];
  }

  static getAvailableModels(): Model[] {
    return Object.values(this.models);
  }
}
const stopper = new InterruptableStoppingCriteria();

self.addEventListener("message", async (event) => {
  if (event.data.type === "chat:stop") {
    stopper.interrupt();
    return;
  }

  let llm = await LLMCompletionPipeline.getInstance((x) => {
    self.postMessage(x);
    console.log(x);
  });

  if (llm === undefined) {
    self.postMessage({ status: "complete", output: "LLM not loaded" });
    return;
  }

  if (event.data.type === "chat:switchModel") {
    const model = event.data.model;
    llm = await LLMCompletionPipeline.switchModel(model, (x) => {
      self.postMessage(x);
    });
  }

  switch (event.data.type) {
    case "chat:message": {
      stopper.reset();
      const st: ChatSettings | undefined = event.data.settings;
      const messages = st?.system_prompt?.trim()
        ? [{ role: "system", content: st.system_prompt.trim() }, ...event.data.messages]
        : event.data.messages;
      const output1 = await llm(messages, {
        max_new_tokens: st?.max_new_tokens ?? 1024,
        do_sample: st?.do_sample ?? false,
        ...(st?.do_sample && {
          temperature: st.temperature,
          top_p: st.top_p,
        }),
        repetition_penalty: st?.repetition_penalty ?? 1,
        // runtime supports it; missing from the pipeline option types
        ...{ stopping_criteria: stopper },
        streamer: new TextStreamer(llm.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (text) => {
            self.postMessage({ status: "update", output: text });
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
