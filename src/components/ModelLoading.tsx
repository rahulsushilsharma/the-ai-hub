import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProgressInfo } from "@huggingface/transformers";
import { useEffect, useState } from "react";
import { Progress } from "./ui/progress";

interface ModelLoadingProps {
  progress: ProgressInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ModelLoading({ progress, open, onOpenChange }: ModelLoadingProps) {
  const [filesProgress, setFilesProgress] = useState<
    Record<string, ProgressInfo>
  >({});

  useEffect(() => {
    if (!progress) return;

    if (progress.status === "ready") {
      return;
    }

    if (!("file" in progress)) return; // v4 "total" progress has no file
    const file = progress.file;
    setFilesProgress((prev) => ({
      ...prev,
      [file]: progress,
    }));
  }, [progress]);

  const filesList = Object.values(filesProgress);
  const modelName = filesList.find((f) => "name" in f)?.name || "Model";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Loading {modelName}</DialogTitle>
          <DialogDescription>
            Downloading model components to your local browser cache.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {filesList.length === 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Initializing...
            </div>
          )}

          {filesList.map((fileInfo) => {
            const isDone = fileInfo.status === "done";
            const isProgress = fileInfo.status === "progress";

            const progressValue = isDone
              ? 100
              : isProgress
              ? fileInfo.progress
              : 0;
            const fileName =
              "file" in fileInfo ? fileInfo.file : "Unknown File";

            return (
              <div key={fileName} className="grid gap-2 mb-2">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className="font-medium truncate max-w-[220px]"
                    title={fileName}
                  >
                    {fileName}
                  </span>
                  <span className="text-muted-foreground capitalize">
                    {isDone
                      ? "Done"
                      : isProgress
                      ? `${progressValue.toFixed(0)}%`
                      : fileInfo.status}
                  </span>
                </div>

                <Progress value={progressValue} className="h-2" />

                {isProgress && (
                  <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>
                      {(fileInfo.loaded / 1024 / 1024).toFixed(2)} MB /{" "}
                      {(fileInfo.total / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ModelLoading;
