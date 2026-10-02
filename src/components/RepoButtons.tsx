import { Github, Package } from "lucide-react";

const link =
  "inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/40";

function GithubButton({ url = "#" }: { url?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={link}>
      <Github className="w-3.5 h-3.5" /> View on GitHub
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function NodeButton({ url = "#" }: { url?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={link}>
      <Package className="w-3.5 h-3.5" /> View on NPM
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export { GithubButton, NodeButton };
