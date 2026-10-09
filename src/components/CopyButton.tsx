import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export function CopyButton({
  getText,
  label = "Copy",
  className,
}: {
  getText: () => string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (insecure context / permission); nothing to do
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={copy}
      className={className ?? "h-6 w-6"}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
