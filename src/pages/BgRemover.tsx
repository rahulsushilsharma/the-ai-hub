"use client";

import Footer from "@/components/Footer";
import PageHeader, { PageGlow } from "@/components/PageHeader";
import SettingsPanel, { type Field } from "@/components/SettingsPanel";
import { useStoredSettings } from "@/hooks/use-stored-settings";
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

const DEFAULTS = { background: "transparent", color: "#ffffff", blur: 12, format: "png", maskOnly: false };

// Composite the cut-out (RGBA) over the chosen background and encode it.
async function compose(cutout: string, o: typeof DEFAULTS, original: string): Promise<string> {
  const load = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  const fg = await load(cutout);
  const c = document.createElement("canvas");
  c.width = fg.width;
  c.height = fg.height;
  const ctx = c.getContext("2d")!;
  if (o.maskOnly) {
    // white where kept, black elsewhere: paint white silhouette via source-in, then black underneath
    ctx.drawImage(fg, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
  } else {
    if (o.background === "color") {
      ctx.fillStyle = o.color;
      ctx.fillRect(0, 0, c.width, c.height);
    } else if (o.background === "blur") {
      ctx.filter = `blur(${o.blur}px)`;
      ctx.drawImage(await load(original), 0, 0, c.width, c.height);
      ctx.filter = "none";
    }
    ctx.drawImage(fg, 0, 0);
  }
  // JPEG/WebP-lossy can't hold alpha: transparent output stays PNG
  const type = o.format === "png" || (o.background === "transparent" && !o.maskOnly) ? "image/png" : `image/${o.format}`;
  return c.toDataURL(type, 0.92);
}

export default function BgRemover() {
  const [cfg, setCfg, resetCfg] = useStoredSettings("bgremover-settings", DEFAULTS);
  const [cutout, setCutout] = useState("");
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
            setCutout(dataUrl);
            setProcessing(false);
          });
          break;
      }
    };

    worker.current.addEventListener("message", onMessage);
    return () => worker.current?.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!cutout) return setResultImage("");
    compose(cutout, cfg, inputImage).then(setResultImage, console.error);
  }, [cutout, cfg, inputImage]);

  const loadModel = () => {
    worker.current?.postMessage({ type: "init" });
    setLoading("loading");
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setInputImage(imageUrl);
      setCutout("");
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
    link.download = `background-removed.${resultImage.slice(11, resultImage.indexOf(";"))}`;
    link.click();
  };

  const status = statusConfig[loading];
  const fields: Field[] = [
    { key: "background", type: "select", label: "Background", options: [
      { value: "transparent", label: "Transparent" },
      { value: "color", label: "Solid colour" },
      { value: "blur", label: "Blurred original" },
    ] },
    ...(cfg.background === "blur" ? [{ key: "blur", type: "slider", label: "Blur", min: 2, max: 40, step: 1 } as Field] : []),
    { key: "format", type: "select", label: "Format", options: [
      { value: "png", label: "PNG" },
      { value: "webp", label: "WebP" },
      { value: "jpeg", label: "JPEG" },
    ], hint: "Transparent output is always PNG." },
    { key: "maskOnly", type: "toggle", label: "Mask only (black & white)" },
  ];

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

        <div className="mt-6">
          <SettingsPanel title="Output" fields={fields} values={cfg} onChange={setCfg} onReset={resetCfg} />
          {cfg.background === "color" && !cfg.maskOnly && (
            <label className="mt-3 flex items-center justify-between rounded-xl border bg-card px-5 py-3 text-sm font-medium">
              Background colour
              <input type="color" value={cfg.color} onChange={(e) => setCfg({ color: e.target.value })} className="h-8 w-12 cursor-pointer bg-transparent" />
            </label>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          All processing happens locally — your images never leave your device.
        </p>
      </div>

      <Footer />
    </div>
  );
}
