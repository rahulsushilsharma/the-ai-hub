import { Github, Package } from "lucide-react";

function GithubButton({ url = "#" }: { url?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      className="flex items-center gap-2 text-blue-500 hover:underline"
    >
      <Github className="w-4 h-4" /> View on Github
    </a>
  );
}

function NodeButton({ url = "#" }: { url?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      className="flex items-center gap-2 text-blue-500 hover:underline"
    >
      <Package className="w-4 h-4" /> View on NPM
    </a>
  );
}
export { GithubButton, NodeButton };
