import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  type AnswerState,
  type InterviewSession,
  loadDraft,
  saveDraft,
} from "@/lib/interview-storage";
import { type Problem, pickRandomProblems } from "@/lib/problems";

interface InterviewContextValue {
  session: InterviewSession | null;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  startInterview: (candidateName: string, position: string) => void;
  updateCode: (index: number, code: string) => void;
  updateLanguage: (index: number, language: string) => void;
  endInterview: () => void;
  totalElapsedSeconds: number;
}

const InterviewContext = createContext<InterviewContextValue | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [activeIndex, setActiveIndexState] = useState(0);
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setSession(draft);
      setTotalElapsedSeconds(
        Math.floor((Date.now() - new Date(draft.startedAt).getTime()) / 1000),
      );
    }
  }, []);

  // Persist on every session change
  useEffect(() => {
    if (session) saveDraft(session);
  }, [session]);

  // Total timer ticks every second
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      setTotalElapsedSeconds(
        Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

  // Per-question timer: increment active answer's timeSpentSeconds every second.
  const lastTickRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!session) return;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = Math.floor((now - lastTickRef.current) / 1000);
      if (delta <= 0) return;
      lastTickRef.current = now;
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, answers: prev.answers.map((a) => ({ ...a })) };
        if (next.answers[activeIndex]) {
          next.answers[activeIndex].timeSpentSeconds += delta;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [session, activeIndex]);

  // When tab is hidden, freeze the per-question accumulator
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        lastTickRef.current = Date.now();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const startInterview = (candidateName: string, position: string) => {
    const picks: Problem[] = pickRandomProblems(2);
    const answers: AnswerState[] = picks.map((p) => ({
      problem: p,
      language: "python",
      code: "",
      timeSpentSeconds: 0,
    }));
    const newSession: InterviewSession = {
      candidateName,
      position,
      startedAt: new Date().toISOString(),
      answers,
    };
    setSession(newSession);
    setActiveIndexState(0);
    setTotalElapsedSeconds(0);
    lastTickRef.current = Date.now();
  };

  const setActiveIndex = (i: number) => {
    lastTickRef.current = Date.now();
    setActiveIndexState(i);
  };

  const updateCode = (index: number, code: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, answers: prev.answers.map((a) => ({ ...a })) };
      next.answers[index].code = code;
      return next;
    });
  };

  const updateLanguage = (index: number, language: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, answers: prev.answers.map((a) => ({ ...a })) };
      next.answers[index].language = language;
      return next;
    });
  };

  const endInterview = () => {
    setSession(null);
    setActiveIndexState(0);
    setTotalElapsedSeconds(0);
  };

  return (
    <InterviewContext.Provider
      value={{
        session,
        activeIndex,
        setActiveIndex,
        startInterview,
        updateCode,
        updateLanguage,
        endInterview,
        totalElapsedSeconds,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error("useInterview must be used within InterviewProvider");
  return ctx;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
