import "highlight.js/styles/github-dark.css";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

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

    code({ className, children, ...rest }) {
      return (
        <pre className="my-4 overflow-x-auto rounded-lg bg-gray-100 dark:bg-gray-900 p-4 break-words">
          <code
            {...rest}
            className={`${
              className || ""
            } text-sm font-mono whitespace-pre-wrap break-words`}
          >
            {children}
          </code>
        </pre>
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
