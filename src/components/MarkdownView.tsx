import "highlight.js/styles/github-dark.css";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { ReactNode } from "react";
import { Children, isValidElement } from "react";
import { CopyButton } from "./CopyButton";

// flatten the highlighted <code> tree back to plain text
function preText(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) =>
      typeof c === "string"
        ? c
        : isValidElement<{ children?: ReactNode }>(c)
        ? preText(c.props.children)
        : ""
    )
    .join("");
}

interface MarkdownViewProps {
  docs: string;
}

export function MarkdownView({ docs }: MarkdownViewProps) {
  const components: Components = {
    a: (props) => (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-4 hover:underline font-medium break-words"
      />
    ),

    blockquote: (props) => (
      <blockquote
        {...props}
        className="border-l-4 border-secondary bg-muted/50 rounded-md px-4 py-2 my-4 text-muted-foreground italic break-words"
      />
    ),

    pre({ children }) {
      return (
        <div className="group/code relative my-4">
          <pre className="overflow-x-auto rounded-lg bg-gray-100 dark:bg-gray-900 p-4">
            {children}
          </pre>
          <CopyButton
            label="Copy code"
            className="absolute right-1.5 top-1.5 h-7 w-7 opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100"
            getText={() => preText(children)}
          />
        </div>
      );
    },

    code({ className, children, ...rest }) {
      const block = !!className || String(children).includes("\n");
      if (!block)
        return (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] break-words">
            {children}
          </code>
        );
      return (
        <code
          {...rest}
          className={`${className ?? ""} text-sm font-mono whitespace-pre-wrap break-words`}
        >
          {children}
        </code>
      );
    },

    img: (props) => (
      <img
        {...props}
        className="rounded-lg shadow-sm my-4 mx-auto max-w-full h-auto"
        alt={props.alt ?? ""}
      />
    ),

    ul: (props) => (
      <ul {...props} className="list-disc pl-6 space-y-1 break-words" />
    ),
    ol: (props) => (
      <ol {...props} className="list-decimal pl-6 space-y-1 break-words" />
    ),
  };

  return (
    <div className="">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={components}>
        {docs}
      </ReactMarkdown>
    </div>
  );
}
