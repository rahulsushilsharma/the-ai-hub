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
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium break-words"
      />
    ),

    blockquote: (props) => (
      <blockquote
        {...props}
        className="border-l-4 border-blue-400 bg-blue-50/40 dark:bg-blue-950/40 rounded-md px-4 py-2 my-4 text-gray-700 dark:text-gray-300 italic break-words"
      />
    ),

    code({ inline, className, children, ...rest }) {
      if (inline) {
        return (
          <code
            {...rest}
            className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[0.9em] font-mono break-words"
          >
            {children}
          </code>
        );
      }

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
    <div
      className="prose prose-zinc dark:prose-invert max-w-3xl mx-auto p-4 sm:p-6 leading-relaxed
                 prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl
                 prose-pre:rounded-xl prose-pre:shadow-md prose-code:text-sm
                 break-words whitespace-pre-wrap w-full overflow-x-hidden"
    >
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={components}>
        {docs}
      </ReactMarkdown>
    </div>
  );
}
