import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Problem } from "@/lib/problems";

export function ProblemView({ problem }: { problem: Problem }) {
  return (
    <article className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {problem.title}
        </h1>
      </header>
      <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground prose-code:text-primary prose-code:before:hidden prose-code:after:hidden">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {problem.description}
        </ReactMarkdown>
      </div>
    </article>
  );
}

