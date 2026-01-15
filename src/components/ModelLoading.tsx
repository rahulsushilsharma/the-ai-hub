import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProgressStatusInfo } from "node_modules/@huggingface/transformers/types/utils/core";
import { Progress } from "./ui/progress";
interface ModelLoadingProps {
  progress: ProgressStatusInfo | null;

  open: boolean;
  onOpenChange: (open: boolean) => void;
}
function ModelLoading(props: ModelLoadingProps) {
  const progress: ProgressStatusInfo | null = props.progress;
  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading Models</DialogTitle>
            <DialogDescription>
              Loading models may take a while, please be patient. This is a
              one-time process.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <h3 className="text-lg font-medium">{progress?.name}</h3>
          </div>
          <div className="grid gap-4 py-4">
            <div className="text-sm text-muted-foreground">
              Loading File: {progress?.file}
            </div>
          </div>
          <div className="grid gap-4 py-4">
            <Progress value={progress?.progress} />
            <div className="text-sm text-muted-foreground">
              {progress?.progress
                ? `${progress?.progress.toFixed(2)}%`
                : "Loading..."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default ModelLoading;
