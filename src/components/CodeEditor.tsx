import Editor from "@monaco-editor/react";
import { Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { runCode, type RunCodeResult } from "@/lib/code-runner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LANGUAGES: Array<{ value: string; label: string; monaco: string }> = [
  { value: "python", label: "Python", monaco: "python" },
  { value: "java", label: "Java", monaco: "java" },
  { value: "cpp", label: "C++", monaco: "cpp" },
  { value: "javascript", label: "JavaScript", monaco: "javascript" },
  { value: "typescript", label: "TypeScript", monaco: "typescript" },
  { value: "go", label: "Go", monaco: "go" },
  { value: "rust", label: "Rust", monaco: "rust" },
  { value: "csharp", label: "C#", monaco: "csharp" },
  { value: "pseudocode", label: "伪代码", monaco: "plaintext" },
];

interface CodeEditorProps {
  language: string;
  code: string;
  onLanguageChange: (lang: string) => void;
  onCodeChange: (code: string) => void;
}

export function CodeEditor({ language, code, onLanguageChange, onCodeChange }: CodeEditorProps) {
  const [stdin, setStdin] = useState("");
  const [runResult, setRunResult] = useState<RunCodeResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const monacoLang = LANGUAGES.find((l) => l.value === language)?.monaco ?? "plaintext";
  const statusMeta = useMemo(() => {
    if (!runResult) return null;
    if (runResult.status === "success") {
      return { label: "通过", className: "border-emerald-500/40 text-emerald-600" };
    }
    if (runResult.status === "timeout") {
      return { label: "超时", className: "border-amber-500/40 text-amber-600" };
    }
    if (runResult.status === "unsupported") {
      return { label: "不可用", className: "border-sky-500/40 text-sky-600" };
    }
    return { label: "错误", className: "border-destructive/50 text-destructive" };
  }, [runResult]);

  async function handleRun() {
    setIsRunning(true);
    setRunResult(null);
    try {
      setRunResult(await runCode({ language, code, stdin }));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">语言</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            className="h-8 gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            {isRunning ? "运行中" : "运行"}
          </Button>
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="min-h-[260px] flex-1">
        <Editor
          height="100%"
          language={monacoLang}
          value={code}
          theme="vs-dark"
          onChange={(v) => onCodeChange(v ?? "")}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 4,
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>
      <div className="grid shrink-0 grid-cols-2 border-t bg-background">
        <div className="min-h-0 border-r p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">自测输入</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setStdin("")}
              disabled={!stdin}
              title="清空输入"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
            填写 JSON：单参数直接填值；多参数按函数顺序包成数组，例如 nums = [1,2,3], k = 3 填
            [[1,2,3],3]。
          </p>
          <Textarea
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            spellCheck={false}
            className="h-20 resize-none font-mono text-xs"
            placeholder={"例如：[[1,2,3],3]"}
          />
        </div>
        <div className="min-h-0 p-3">
          <div className="mb-2 flex h-7 items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">运行结果</div>
            {statusMeta ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusMeta.className}>
                  {statusMeta.label}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {runResult?.durationMs}ms
                </span>
              </div>
            ) : null}
          </div>
          <pre className="h-28 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {isRunning
              ? "运行中..."
              : runResult
                ? [runResult.stdout, runResult.stderr]
                    .filter((part) => part.trim().length > 0)
                    .join("\n")
                : "点击运行后显示 stdout、stderr 或编译错误。"}
          </pre>
        </div>
      </div>
    </div>
  );
}
