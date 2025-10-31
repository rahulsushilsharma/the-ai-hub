"use client";

import ModelLoading from "@/components/ModelLoading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
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

export default function BgRemover() {
  const [inputImage, setInputImage] = useState<string>("");
  const [resultImage, setResultImage] = useState<string>("");
  const [loading, setLoading] = useState<"ready" | "loading" | "done">("ready");
  const [progress, setProgress] = useState<ProgressStatusInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [openProgress, setOpenProgress] = useState(false);
  const worker = useRef<Worker | null>(null);

  // Converts raw RGBA image to a usable data URL
  async function rawImageToDataURL(rawImage: RawImage): Promise<string> {
    const canvas = document.createElement("canvas");
    canvas.width = rawImage.width;
    canvas.height = rawImage.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get 2D rendering context");
    const imageData = new ImageData(
      new Uint8ClampedArray(rawImage.data),
      rawImage.width,
      rawImage.height
    );
    ctx.putImageData(imageData, 0, 0);
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

  const getStatusBadge = () => {
    switch (loading) {
      case "ready":
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200">
            🟢 Ready
          </Badge>
        );
      case "loading":
        return (
          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
            ⏳ Loading model...
          </Badge>
        );
      case "done":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
            ✅ Model Loaded
          </Badge>
        );
    }
  };

  return (
    <main className="container max-w-2xl mx-auto py-10 px-4 pt-20 relative">
      <ModelLoading
        progress={progress}
        open={openProgress}
        onOpenChange={setOpenProgress}
      />

      {/* Image Processing Loader Overlay */}

      <Card className="shadow-lg border border-gray-200/70 rounded-2xl relative z-10">
        <CardHeader className="text-center space-y-2">
          <h1 className="text-2xl font-semibold flex items-center justify-center gap-2">
            🖼️ Background Remover
          </h1>
          <p className="text-muted-foreground text-sm">
            Remove backgrounds from images locally in your browser.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex justify-center">{getStatusBadge()}</div>

          <div className="flex justify-center">
            <Button
              onClick={loadModel}
              disabled={loading === "loading"}
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

          <div className="space-y-3">
            <Label htmlFor="picture">Upload Image</Label>
            <Input
              id="picture"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
            {processing && (
              <div className="inset-0 bg-secondary/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Processing image...</p>
              </div>
            )}
            {inputImage && (
              <div className="flex flex-col items-center gap-2 mt-4">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <ImageIcon className="w-4 h-4" /> Original Image
                </h4>
                <img
                  src={inputImage}
                  alt="Input"
                  className="rounded-lg max-h-64 object-contain border"
                />
              </div>
            )}

            {resultImage && (
              <div className="border-t pt-4 mt-4 flex flex-col items-center">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Result
                </h4>
                <img
                  src={resultImage}
                  alt="Background Removed"
                  className="rounded-lg w-full max-h-64 object-contain border"
                />
                <Button
                  onClick={handleDownload}
                  variant="secondary"
                  className="mt-3 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Image
                </Button>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="text-center text-xs text-muted-foreground">
          Built with ❤️ using local browser inference
        </CardFooter>
      </Card>
    </main>
  );
}
