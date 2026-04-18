"use client";

import Footer from "@/components/Footer";
import ModelLoading from "@/components/ModelLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RawImage } from "@huggingface/transformers";
import {
  CheckCircle,
  Download,
  Image as ImageIcon,
  Loader2,
  Rocket,
} from "lucide-react";
import type { ProgressStatusInfo } from "node_modules/@huggingface/transformers/types/utils/core";
import { useEffect, useRef, useState } from "react";
import BgRemoverWorker from "../workers/bgRemover.ts?worker";

const statusConfig = {
  ready: { label: "Ready to load", color: "text-green-400", dot: "bg-green-400" },
  loading: { label: "Loading model...", color: "text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
  done: { label: "Model loaded", color: "text-emerald-400", dot: "bg-emerald-400" },
};

export default function BgRemover() {
  const [inputImage, setInputImage] = useState<string>("");
  const [resultImage, setResultImage] = useState<string>("");
  const [loading, setLoading] = useState<"ready" | "loading" | "done">("ready");
  const [progress, setProgress] = useState<ProgressStatusInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [openProgress, setOpenProgress] = useState(false);
  const worker = useRef<Worker | null>(null);

  async function rawImageToDataURL(rawImage: RawImage): Promise<string> {
    const canvas = document.createElement("canvas");
    canvas.width = rawImage.width;
    canvas.height = rawImage.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get 2D rendering context");
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(rawImage.data), rawImage.width, rawImage.height),
      0,
      0
    );
    return canvas.toDataURL("image/png");
  }

  useEffect(() => {
    if (!worker.current) worker.current = new BgRemoverWorker();

    const onMessage = async (e: MessageEvent) => {
      const { status, output } = e.data;
      switch (status) {
        case "error":
          console.error(e.data.message);
          setProcessing(false);
          break;
        case "initiate":
        case "progress":
          setProgress(e.data);
          setOpenProgress(true);
          break;
        case "done":
          setLoading("done");
          setProgress(e.data);
          setOpenProgress(false);
          setProcessing(false);
          break;
        case "complete":
          rawImageToDataURL(output).then((dataUrl) => {
            setResultImage(dataUrl);
            setProcessing(false);
          });
          break;
      }
    };

    worker.current.addEventListener("message", onMessage);
    return () => worker.current?.removeEventListener("message", onMessage);
  }, []);

  const loadModel = () => {
    worker.current?.postMessage({ type: "init" });
    setLoading("loading");
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setInputImage(imageUrl);
      setResultImage("");
      setProcessing(true);
      worker.current?.postMessage({ type: "image", image: imageUrl });
    } else {
      setInputImage("");
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement("a");
    link.href = resultImage;
    link.download = "background-removed.png";
    link.click();
  };

  const status = statusConfig[loading];

  return (
    <div className="pt-16 md:pt-24 min-h-screen relative overflow-x-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 blur-[80px] md:blur-3xl rounded-full" />
      </div>

      <ModelLoading progress={progress} open={openProgress} onOpenChange={setOpenProgress} />

      <div className="container max-w-2xl mx-auto px-4 pb-16">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 ring-1 ring-primary/20 mb-4">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            <span className="bg-gradient-to-br from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Background Remover
            </span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            Remove backgrounds from images locally in your browser — zero uploads, full privacy.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
            {["Local AI", "ONNX Runtime", "Privacy-first", "WebGPU"].map((f) => (
              <span
                key={f}
                className="text-[10px] md:text-xs px-2.5 py-0.5 rounded-full bg-muted/60 backdrop-blur border border-border/50"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Main card */}
        <div className="group relative rounded-2xl border bg-background/60 backdrop-blur-xl p-5 md:p-6 transition-all duration-300 hover:shadow-2xl hover:border-primary/40">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          <div className="relative space-y-6">
            {/* Status */}
            <div className="flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
            </div>

            {/* Load model */}
            <div className="flex justify-center">
              <Button
                onClick={loadModel}
                disabled={loading === "loading"}
                className="flex items-center gap-2"
              >
                {loading === "loading" ? (
                  <><Loader2 className="animate-spin w-4 h-4" /> Loading...</>
                ) : (
                  <><Rocket className="w-4 h-4" /> {loading === "ready" ? "Load Model" : "Reload Model"}</>
                )}
              </Button>
            </div>

            {/* Upload */}
            <div className="space-y-2">
              <Label htmlFor="picture" className="text-sm font-medium">Upload Image</Label>
              <Input
                id="picture"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="border-border/50 bg-muted/30"
              />
            </div>

            {/* Processing state */}
            {processing && (
              <div className="flex flex-col items-center justify-center gap-2 py-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Processing image...</p>
              </div>
            )}

            {/* Images */}
            {inputImage && (
              <div className={`grid gap-4 ${resultImage ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Original
                  </span>
                  <img
                    src={inputImage}
                    alt="Input"
                    className="rounded-xl max-h-56 object-contain border border-border/50 w-full"
                  />
                </div>
                {resultImage && (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Result
                    </span>
                    <img
                      src={resultImage}
                      alt="Background Removed"
                      className="rounded-xl max-h-56 object-contain border border-border/50 w-full"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Download */}
            {resultImage && (
              <div className="flex justify-center pt-2">
                <Button onClick={handleDownload} variant="secondary" className="flex items-center gap-2">
                  <Download className="w-4 h-4" /> Download Image
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          All processing happens locally — your images never leave your device.
        </p>
      </div>

      <Footer />
    </div>
  );
}
