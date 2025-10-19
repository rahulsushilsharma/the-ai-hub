"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2, Rocket, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TtsWorker from "../workers/tts.ts?worker";
export default function TtsDemo() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState<
    "ready" | "loading" | "streaming" | "done"
  >("ready");
  const worker = useRef<Worker | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!worker.current) {
      worker.current = new TtsWorker();
    }

    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.type) {
        case "error":
          console.error(e.data.message);
          break;
        case "stream":
          setLoading("streaming");
          break;
        case "model:loaded":
          setLoading("done");
          break;
        case "model:error":
          console.error(e.data.message);
          setLoading("ready");
          break;
        case "done":
          setLoading("done");
          setAudioUrl(URL.createObjectURL(e.data.audio));
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);
    return () =>
      worker.current?.removeEventListener("message", onMessageReceived);
  }, []);

  const loadModel = () => {
    worker.current?.postMessage({ type: "init" });
    setLoading("loading");
  };

  const generateAudio = () => {
    worker.current?.postMessage({ type: "clear" });
    worker.current?.postMessage({ type: "message", message: input });
  };

  const getStatusBadge = () => {
    switch (loading) {
      case "ready":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            🟢 Ready
          </Badge>
        );
      case "loading":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            ⏳ Loading model...
          </Badge>
        );
      case "streaming":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            🎧 Generating...
          </Badge>
        );
      case "done":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            ✅ Model Loaded
          </Badge>
        );
    }
  };

  return (
    <main className="container max-w-2xl mx-auto py-10 px-4">
      <div>
        <Card className="shadow-lg border border-gray-200/70 rounded-2xl">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-semibold flex items-center justify-center gap-2">
              🎙️ TTS Pipelines Demo
            </h1>
            <p className="text-muted-foreground text-sm">
              Powered by{" "}
              <a
                href="https://www.npmjs.com/package/tts-pipelines"
                target="_blank"
                className="text-blue-500 hover:underline"
              >
                tts-pipelines
              </a>
              .
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex justify-center">{getStatusBadge()}</div>

            <div className="flex justify-center">
              <Button
                variant="default"
                onClick={loadModel}
                disabled={loading === "loading" || loading === "streaming"}
                className="flex items-center gap-2"
              >
                {loading === "loading" ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" /> Loading...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />{" "}
                    {loading === "ready" ? "Load Model" : "Reload Model"}
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Your text:
              </label>
              <Textarea
                placeholder="Type something you'd like to hear..."
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading !== "done"}
              />
              <Button
                className="w-full flex items-center justify-center gap-2"
                onClick={generateAudio}
                disabled={loading !== "done" || !input.trim()}
              >
                <Volume2 className="w-4 h-4" /> Generate Speech
              </Button>
            </div>

            <>
              {audioUrl && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1 text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" /> Preview
                  </h4>
                  <audio
                    controls
                    src={audioUrl}
                    className="w-full rounded-lg"
                  />
                </div>
              )}
            </>
          </CardContent>

          <CardFooter className="text-center text-xs text-muted-foreground">
            Built with ❤️ using{" "}
            <a
              href="https://www.npmjs.com/package/tts-pipelines"
              target="_blank"
              className="text-blue-500 hover:underline ml-1"
            >
              tts-pipelines
            </a>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
