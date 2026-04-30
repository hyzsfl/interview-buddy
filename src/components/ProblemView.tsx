import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Problem } from "@/lib/problems";
import { Badge } from "@/components/ui/badge";

export function ProblemView({ problem }: { problem: Problem }) {
  return (
    <article className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">#{problem.id}</Badge>
          <Badge>{problem.category}</Badge>
          <Badge variant="outline">{problem.difficulty}</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {problem.title}
        </h1>
        <div className="flex flex-wrap gap-1.5">
          {problem.tags.map((t) => (
            <span
              key={t}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </header>
      <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground prose-code:text-primary prose-code:before:hidden prose-code:after:hidden">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {problem.description}
        </ReactMarkdown>
      </div>
      <div className="text-xs text-muted-foreground">
        题源：
        <a
          href={problem.url}
          target="_blank"
          rel="noreferrer noopener"
          className="underline hover:text-foreground"
        >
          {problem.url}
        </a>
      </div>
    </article>
  );
}
