import { invoke } from "@tauri-apps/api/core";

export type RunStatus = "success" | "error" | "timeout" | "unsupported";

export interface RunCodeOptions {
  language: string;
  code: string;
  stdin: string;
}

export interface RunCodeResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  command?: string;
}

interface TauriRunCodeResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  command: string;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export async function runCode(options: RunCodeOptions): Promise<RunCodeResult> {
  if (isTauriRuntime()) {
    try {
      return await invoke<TauriRunCodeResult>("run_code", { request: options });
    } catch (error) {
      return {
        status: "error",
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: null,
        durationMs: 0,
      };
    }
  }

  if (options.language === "javascript") {
    return runJavaScriptInWorker(options);
  }

  return {
    status: "unsupported",
    stdout: "",
    stderr: "当前浏览器预览只支持 JavaScript 自测。请在桌面端使用本机编译/运行环境。",
    exitCode: null,
    durationMs: 0,
  };
}

function runJavaScriptInWorker({ code, stdin }: RunCodeOptions): Promise<RunCodeResult> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const workerSource = `
      const formatValue = (value) => {
        if (typeof value === "string") return value;
        if (typeof value === "undefined") return "undefined";
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      };

      self.onmessage = async (event) => {
        const { code, stdin } = event.data;
        const logs = [];
        const capture = (...args) => logs.push(args.map(formatValue).join(" "));
        console.log = capture;
        console.info = capture;
        console.warn = capture;
        console.error = capture;

        try {
          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
          const run = new AsyncFunction("stdin", "input", "readInput", \`
            \${code}

            const __interviewBuddyRunSolution = async () => {
              if (!stdin.trim() || typeof Solution === "undefined") return undefined;
              const solution = new Solution();
              const methodName = Object.getOwnPropertyNames(Solution.prototype)
                .find((name) => name !== "constructor" && typeof solution[name] === "function");
              if (!methodName) throw new Error("Solution 中没有可调用的公开方法");
              const method = solution[methodName].bind(solution);
              const payload = JSON.parse(stdin);
              const args = method.length <= 1 ? [payload] : payload;
              return await method(...args);
            };

            return await __interviewBuddyRunSolution();
          \`);
          const value = await run(stdin, stdin, () => stdin);
          if (typeof value !== "undefined") logs.push(formatValue(value));
          self.postMessage({ status: "success", stdout: logs.join("\\n"), stderr: "" });
        } catch (error) {
          self.postMessage({
            status: "error",
            stdout: logs.join("\\n"),
            stderr: error && error.stack ? error.stack : String(error),
          });
        }
      };
    `;

    const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    const worker = new Worker(workerUrl);
    const timeout = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        status: "timeout",
        stdout: "",
        stderr: "运行超过 3 秒，已停止。",
        exitCode: null,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }, 3000);

    worker.onmessage = (
      event: MessageEvent<{ status: RunStatus; stdout: string; stderr: string }>,
    ) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        status: event.data.status,
        stdout: event.data.stdout,
        stderr: event.data.stderr,
        exitCode: event.data.status === "success" ? 0 : 1,
        durationMs: Math.round(performance.now() - startedAt),
      });
    };

    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        status: "error",
        stdout: "",
        stderr: event.message,
        exitCode: 1,
        durationMs: Math.round(performance.now() - startedAt),
      });
    };

    worker.postMessage({ code, stdin });
  });
}
