import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ClipboardCheck } from "lucide-react";

const searchSchema = z.object({
  filename: z.string().optional().default(""),
  copied: z.string().optional().default("0"),
});

export const Route = createFileRoute("/done")({
  validateSearch: (search) => searchSchema.parse(search),
  component: DonePage,
});

function DonePage() {
  const { filename, copied } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <CardTitle className="text-2xl">测评已提交</CardTitle>
          <CardDescription>
            作答结果已保存到本地。可将文件提交给 AI 进行评分分析。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filename && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="text-xs text-muted-foreground">下载文件</div>
              <div className="mt-1 break-all font-mono">{filename}</div>
            </div>
          )}
          {copied === "1" && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <span>同时已复制到剪贴板，可直接粘贴给 AI。</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            如果浏览器未弹出下载，请检查下载拦截设置后重新提交。
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => navigate({ to: "/" })}>
              开始新的面试
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
