// class MyTranslationPipeline {
//   static task = "translation";
//   static model = "Xenova/nllb-200-distilled-600M";
//   static instance = null;

//   static async getInstance(progress_callback = null) {
//     if (this.instance === null) {
//       this.instance = pipeline(this.task, this.model, { progress_callback });
//     }

//     return this.instance;
//   }
// }
self.addEventListener("message", async (event) => {
  // Retrieve the translation pipeline. When called for the first time,
  // this will load the pipeline and save it for future use.
  // let translator = await MyTranslationPipeline.getInstance((x) => {
  //   // We also add a progress callback to the pipeline so that we can
  //   // track model loading.
  //   self.postMessage(x);
  // });
  // const llm = await LLMCompletionPipeline.getInstance((x) => {
  // We also add a progress callback to the pipeline so that we can
  // track model loading.
  //   self.postMessage(x);
  // });

  // const messages = [
  //   { role: "system", content: "You are a helpful assistant." },
  //   { role: "user", content: "Write a poem about machine learning." },
  // ];

  // // Generate a response
  // const output1 = await llm(messages, {
  //   max_new_tokens: 512,
  //   do_sample: false,
  //   streamer: new TextStreamer(llm.tokenizer, {
  //     skip_prompt: true,
  //     skip_special_tokens: true,
  //     // callback_function: (text) => { /* Optional callback function */ },
  //   }),
  // });
  // console.log(output1[0].generated_text.at(-1).content);
  // If the input text is empty, return an empty string
  // if (event.data.text.trim().length === 0) {
  //   self.postMessage({ status: "complete", output: "" });
  //   return;
  // }

  // Actually perform the translation
  // let output = await translator(event.data.text, {
  //   tgt_lang: event.data.tgt_lang,
  //   src_lang: event.data.src_lang,

  //   // Allows for partial output
  //   callback_function: (x) => {
  //     self.postMessage({
  //       status: "update",
  //       output: translator.tokenizer.decode(x[0].output_token_ids, {
  //         skip_special_tokens: true,
  //       }),
  //     });
  //   },
  // });
  // console.log(output);

  // // Send the output back to the main thread
  // self.postMessage({
  //   status: "complete",
  //   output: output,
  // });

  console.log(event);
});
