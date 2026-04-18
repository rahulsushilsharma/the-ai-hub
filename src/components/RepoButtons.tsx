import { Github, Package } from "lucide-react";

function GithubButton({ url = "#" }: { url?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-muted/60 backdrop-blur border border-border/50 text-primary hover:border-primary/40 transition-colors"
    >
      <Github className="w-3.5 h-3.5" /> View on GitHub
    </a>
  );
}

function NodeButton({ url = "#" }: { url?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-muted/60 backdrop-blur border border-border/50 text-primary hover:border-primary/40 transition-colors"
    >
      <Package className="w-3.5 h-3.5" /> View on NPM
    </a>
  );
}

export { GithubButton, NodeButton };
