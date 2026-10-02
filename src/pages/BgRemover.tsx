"use client";

import Footer from "@/components/Footer";
import PageHeader, { PageGlow } from "@/components/PageHeader";
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
  ready: { label: "Ready to load", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  loading: { label: "Loading model...", color: "text-secondary-foreground", dot: "bg-secondary animate-pulse" },
  done: { label: "Model loaded", color: "text-primary", dot: "bg-primary" },
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
      <PageGlow />

      <ModelLoading progress={progress} open={openProgress} onOpenChange={setOpenProgress} />

      <div className="container max-w-2xl mx-auto px-4 pb-16">
        <PageHeader icon={ImageIcon} title="Background remover" blurb="Remove backgrounds from images locally in your browser. Zero uploads, full privacy." tags={["Local AI", "ONNX Runtime", "Privacy-first", "WebGPU"]} />

        {/* Main card */}
        <div className="group relative rounded-xl border bg-card p-5 md:p-6 transition-all duration-300 hover:border-primary/40">

          <div className="relative space-y-6">
            {/* Status */}
            <div role="status" className="flex items-center justify-center gap-2">
              <span aria-hidden="true" className={`w-2 h-2 rounded-full ${status.dot}`} />
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
                  <><Rocket className="w-4 h-4" /> {loading === "ready" ? "Load model" : "Reload model"}</>
                )}
              </Button>
            </div>

            {/* Upload */}
            <div className="space-y-2">
              <Label htmlFor="picture" className="text-sm font-medium">Upload image</Label>
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
                <Loader2 className="w-8 h-8 animate-spin text-primary motion-reduce:animate-none" />
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
                    alt="Original upload"
                    className="rounded-lg max-h-56 object-contain border border-border/50 w-full"
                  />
                </div>
                {resultImage && (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Result
                    </span>
                    <img
                      src={resultImage}
                      alt="Background Removed"
                      className="rounded-lg max-h-56 object-contain border border-border/50 w-full"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Download */}
            {resultImage && (
              <div className="flex justify-center pt-2">
                <Button onClick={handleDownload} variant="secondary" className="flex items-center gap-2">
                  <Download className="w-4 h-4" /> Download image
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
