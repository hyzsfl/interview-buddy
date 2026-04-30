import type { Problem } from "./problems";

export interface AnswerState {
  problem: Problem;
  language: string;
  code: string;
  timeSpentSeconds: number;
}

export interface InterviewSession {
  candidateName: string;
  position: string;
  startedAt: string; // ISO
  answers: AnswerState[];
}

const DRAFT_KEY = "interview-draft-v1";

export function saveDraft(session: InterviewSession) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

export function loadDraft(): InterviewSession | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InterviewSession;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function safeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 30) || "anonymous";
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatStamp(d: Date): string {
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

export interface SubmissionResult {
  filename: string;
  payload: object;
}

export function buildSubmissionPayload(session: InterviewSession): SubmissionResult {
  const submittedAt = new Date();
  const totalDurationSeconds = session.answers.reduce(
    (s, a) => s + a.timeSpentSeconds,
    0,
  );
  const payload = {
    meta: {
      candidateName: session.candidateName,
      position: session.position,
      interviewStartedAt: session.startedAt,
      submittedAt: submittedAt.toISOString(),
      totalDurationSeconds,
      appVersion: "1.0.0",
      note: "本文件为面试者作答原始记录，包含题面与代码，可直接交给 AI 评分。",
    },
    answers: session.answers.map((a) => ({
      problemId: a.problem.id,
      title: a.problem.title,
      category: a.problem.category,
      difficulty: a.problem.difficulty,
      tags: a.problem.tags,
      url: a.problem.url,
      problemDescription: a.problem.description,
      language: a.language,
      code: a.code,
      timeSpentSeconds: a.timeSpentSeconds,
    })),
  };
  const filename = `interview-${safeFilenamePart(session.candidateName)}-${safeFilenamePart(session.position)}-${formatStamp(submittedAt)}.json`;
  return { filename, payload };
}

export async function downloadSubmission(session: InterviewSession): Promise<{
  filename: string;
  copiedToClipboard: boolean;
}> {
  const { filename, payload } = buildSubmissionPayload(session);
  const json = JSON.stringify(payload, null, 2);

  // Trigger download
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  // Try clipboard as fallback
  let copiedToClipboard = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(json);
      copiedToClipboard = true;
    }
  } catch {
    // ignore
  }
  return { filename, copiedToClipboard };
}
