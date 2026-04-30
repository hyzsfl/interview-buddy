import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useInterview } from "@/context/InterviewContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POSITION_OPTIONS = [
  "全栈工程师",
  "前端工程师",
  "后端工程师",
  "移动端工程师",
  "数据工程师",
  "算法工程师",
  "测试工程师",
  "DevOps 工程师",
];
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export const Route = createFileRoute("/")({
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const { startInterview, session, endInterview } = useInterview();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("全栈工程师");

  

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !position.trim()) return;
    startInterview(name.trim(), position.trim());
    navigate({ to: "/interview" });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            算法测评题
          </h1>
          <p className="text-muted-foreground">
            随机抽取 2 道不同分类的热题100中等题 · 任意语言作答 · 提交后导出 JSON
          </p>
        </header>

        {session ? (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle>检测到未完成的测评</CardTitle>
              <CardDescription>
                {session.candidateName} · {session.position} · 已开始于{" "}
                {new Date(session.startedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => navigate({ to: "/interview" })}>
                继续测评
              </Button>
              <Button variant="outline" onClick={endInterview}>
                放弃并开始新的
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>开始测评</CardTitle>
              <CardDescription>
                请填写候选人信息。点击"开始"后将随机抽取题目，计时立即开始。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStart} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">候选人姓名</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：张三"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">应聘岗位</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger id="position">
                      <SelectValue placeholder="请选择岗位" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" size="lg">
                  开始测评
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
