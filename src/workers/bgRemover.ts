import {
  ImageSegmentationPipeline,
  pipeline,
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
  });

  if (bgRemover === undefined) {
    self.postMessage({ status: "complete", output: "LLM not loaded" });
    return;
  }

  switch (event.data.type) {
    case "image": {
      const output1 = await bgRemover(event.data.image, {});
      self.postMessage({
        status: "complete",
        output: output1[0],
      });
    }
  }
});
