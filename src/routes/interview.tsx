import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useInterview, formatDuration } from "@/context/InterviewContext";
import { ProblemView } from "@/components/ProblemView";
import { CodeEditor } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadSubmission, clearDraft } from "@/lib/interview-storage";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/interview")({
  component: InterviewPage,
});

function InterviewPage() {
  const navigate = useNavigate();
  const {
    session,
    activeIndex,
    setActiveIndex,
    updateCode,
    updateLanguage,
    endInterview,
    totalElapsedSeconds,
  } = useInterview();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect to welcome if no session
  useEffect(() => {
    if (!session) navigate({ to: "/" });
  }, [session, navigate]);

  if (!session) return null;
  const active = session.answers[activeIndex];

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    try {
      const result = await downloadSubmission(session);
      clearDraft();
      endInterview();
      toast.success(`已下载 ${result.filename}`);
      navigate({
        to: "/done",
        search: {
          filename: result.filename,
          copied: result.copiedToClipboard ? "1" : "0",
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("保存失败，请重试");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">{session.candidateName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{session.position}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1 font-mono text-sm tabular-nums">
            <span className="text-muted-foreground">总用时</span>
            <span className="font-semibold">{formatDuration(totalElapsedSeconds)}</span>
          </div>
          <Button
            variant="default"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
          >
            提交全部
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="shrink-0 border-b bg-card px-4 py-2">
        <Tabs value={String(activeIndex)} onValueChange={(v) => setActiveIndex(Number(v))}>
          <TabsList>
            {session.answers.map((a, i) => (
              <TabsTrigger key={i} value={String(i)} className="gap-2">
                <span>题目 {i + 1}</span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {formatDuration(a.timeSpentSeconds)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Split panel */}
      <div className="flex min-h-0 flex-1">
        <div className="w-1/2 overflow-y-auto border-r p-6">
          <ProblemView problem={active.problem} />
        </div>
        <div className="w-1/2 p-3">
          <CodeEditor
            language={active.language}
            code={active.code}
            onLanguageChange={(lang) => updateLanguage(activeIndex, lang)}
            onCodeChange={(code) => updateCode(activeIndex, code)}
          />
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认提交测评？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>提交后将自动下载 JSON 文件并清除当前作答记录。</div>
                <ul className="space-y-1 rounded-md bg-muted p-3 text-sm">
                  {session.answers.map((a, i) => {
                    const lines = a.code.split("\n").filter((l) => l.trim()).length;
                    return (
                      <li key={i} className="flex justify-between">
                        <span>
                          题目 {i + 1}：{a.problem.title}
                        </span>
                        <span className="text-muted-foreground">
                          {a.language} · {lines} 行 · {formatDuration(a.timeSpentSeconds)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting ? "提交中..." : "确认提交"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
