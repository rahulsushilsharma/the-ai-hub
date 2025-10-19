import { PiperTTS, TextSplitterStream } from "tts-pipelines";
// or KittenTTS:
// import { KittenTTS,TextSplitterStream } from "tts-pipelines";
// const tts = await KittenTTS.from_pretrained();
let tts: PiperTTS | null = null;

self.addEventListener("message", async (event) => {
  if (event.data.type === "init") {
    try {
      console.log("loading...");

      tts = await PiperTTS.from_pretrained();
      console.log("loaded");
      self.postMessage({
        type: "model:loaded",
        message: "pipelines ready",
      });
    } catch (error) {
      self.postMessage({
        type: "model:error",
        message: error,
      });
    }
  }

  if (event.data.type === "message") {
    if (tts == null) {
      self.postMessage({
        type: "error",
        message: "tts instance is not initalized",
      });
      return;
    }
    const streamer = new TextSplitterStream();

    streamer.push(event.data.message);
    streamer.close(); // Indicate we won't add more text

    const stream = tts.stream(streamer);

    try {
      for await (const { text, audio } of stream) {
        self.postMessage({
          type: "stream",
          chunk: {
            audio: audio.toBlob(),
            text,
          },
        });
      }
    } catch (error) {
      console.error("Error during streaming:", error);
    }
    const audio = tts.merge_audio();
    self.postMessage({
      type: "done",
      audio: audio?.toBlob(),
    });
  }
  if (event.data.type == "clear") {
    tts?.clearAudio();
  }
});
