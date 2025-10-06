import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DoneProgressInfo,
  DownloadProgressInfo,
  InitiateProgressInfo,
  ProgressStatusInfo,
  ReadyProgressInfo,
} from "node_modules/@huggingface/transformers/types/utils/core";
import { Progress } from "./ui/progress";
interface ModelLoadingProps {
  progress:
    | InitiateProgressInfo
    | DownloadProgressInfo
    | ProgressStatusInfo
    | DoneProgressInfo
    | ReadyProgressInfo
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
function ModelLoading(props: ModelLoadingProps) {
  console.log("Rendering ModelLoading with props:", props.progress);
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
            <h3 className="text-lg font-medium">{props.progress?.name}</h3>
            <h3 className="text-lg font-medium">{props.progress?.model}</h3>
          </div>
          <div className="grid gap-4 py-4">
            <Progress value={props.progress?.progress} />
            <div className="text-sm text-muted-foreground">
              {props.progress?.progress
                ? `${props.progress?.progress.toFixed(2)}%`
                : "Loading..."}{" "}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default ModelLoading;
