import Editor from "@monaco-editor/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const LANGUAGES: Array<{ value: string; label: string; monaco: string }> = [
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

export function CodeEditor({
  language,
  code,
  onLanguageChange,
  onCodeChange,
}: CodeEditorProps) {
  const monacoLang =
    LANGUAGES.find((l) => l.value === language)?.monaco ?? "plaintext";
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">语言</div>
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
      <div className="flex-1 min-h-0">
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
    </div>
  );
}
