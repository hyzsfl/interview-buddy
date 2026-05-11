use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::Builder;

const RUN_TIMEOUT: Duration = Duration::from_secs(5);
const COMPILE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunCodeRequest {
    language: String,
    code: String,
    stdin: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunCodeResponse {
    status: String,
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    duration_ms: u128,
    command: String,
}

struct CommandSpec {
    program: String,
    args: Vec<String>,
    cwd: PathBuf,
    stdin: String,
    timeout: Duration,
}

struct CommandOutput {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    duration_ms: u128,
    timed_out: bool,
    command: String,
}

#[tauri::command]
fn run_code(request: RunCodeRequest) -> Result<RunCodeResponse, String> {
    let workdir = create_workdir()?;
    let result = run_code_in_workdir(&request, &workdir);
    let _ = fs::remove_dir_all(&workdir);
    result
}

fn run_code_in_workdir(
    request: &RunCodeRequest,
    workdir: &Path,
) -> Result<RunCodeResponse, String> {
    let language = request.language.as_str();
    match language {
        "python" => {
            let source = workdir.join("main.py");
            fs::write(&source, &request.code).map_err(|err| err.to_string())?;
            let candidates = vec![
                command("python3", vec![path_arg(&source)], workdir, &request.stdin, RUN_TIMEOUT),
                command("python", vec![path_arg(&source)], workdir, &request.stdin, RUN_TIMEOUT),
            ];
            output_to_response(run_first_available(candidates)?)
        }
        "javascript" => {
            let source = workdir.join("main.js");
            fs::write(&source, &request.code).map_err(|err| err.to_string())?;
            output_to_response(run_first_available(vec![command(
                "node",
                vec![path_arg(&source)],
                workdir,
                &request.stdin,
                RUN_TIMEOUT,
            )])?)
        }
        "java" => {
            let source = workdir.join("Main.java");
            fs::write(&source, &request.code).map_err(|err| err.to_string())?;
            let compile = run_first_available(vec![command(
                "javac",
                vec![path_arg(&source)],
                workdir,
                "",
                COMPILE_TIMEOUT,
            )])?;
            if compile.timed_out || compile.exit_code != Some(0) {
                return output_to_response(compile);
            }
            output_to_response(run_first_available(vec![command(
                "java",
                vec!["Main".to_string()],
                workdir,
                &request.stdin,
                RUN_TIMEOUT,
            )])?)
        }
        "cpp" => {
            let source = workdir.join("main.cpp");
            let binary = workdir.join("main");
            fs::write(&source, &request.code).map_err(|err| err.to_string())?;
            let args = vec![
                path_arg(&source),
                "-std=c++17".to_string(),
                "-O2".to_string(),
                "-pipe".to_string(),
                "-o".to_string(),
                path_arg(&binary),
            ];
            let compile = run_first_available(vec![
                command("clang++", args.clone(), workdir, "", COMPILE_TIMEOUT),
                command("g++", args, workdir, "", COMPILE_TIMEOUT),
            ])?;
            if compile.timed_out || compile.exit_code != Some(0) {
                return output_to_response(compile);
            }
            output_to_response(run_first_available(vec![command(
                path_arg(&binary),
                vec![],
                workdir,
                &request.stdin,
                RUN_TIMEOUT,
            )])?)
        }
        "go" => {
            let source = workdir.join("main.go");
            fs::write(&source, &request.code).map_err(|err| err.to_string())?;
            output_to_response(run_first_available(vec![command(
                "go",
                vec!["run".to_string(), path_arg(&source)],
                workdir,
                &request.stdin,
                RUN_TIMEOUT,
            )])?)
        }
        "rust" => {
            let source = workdir.join("main.rs");
            let binary = workdir.join("main");
            fs::write(&source, &request.code).map_err(|err| err.to_string())?;
            let compile = run_first_available(vec![command(
                "rustc",
                vec![path_arg(&source), "-O".to_string(), "-o".to_string(), path_arg(&binary)],
                workdir,
                "",
                COMPILE_TIMEOUT,
            )])?;
            if compile.timed_out || compile.exit_code != Some(0) {
                return output_to_response(compile);
            }
            output_to_response(run_first_available(vec![command(
                path_arg(&binary),
                vec![],
                workdir,
                &request.stdin,
                RUN_TIMEOUT,
            )])?)
        }
        "typescript" | "csharp" | "pseudocode" => Ok(RunCodeResponse {
            status: "unsupported".to_string(),
            stdout: String::new(),
            stderr: "当前语言暂未接入本机运行器，请切换到 Python、JavaScript、Java、C++、Go 或 Rust 自测。".to_string(),
            exit_code: None,
            duration_ms: 0,
            command: String::new(),
        }),
        _ => Ok(RunCodeResponse {
            status: "unsupported".to_string(),
            stdout: String::new(),
            stderr: format!("暂不支持语言：{}", request.language),
            exit_code: None,
            duration_ms: 0,
            command: String::new(),
        }),
    }
}

fn command(
    program: impl Into<String>,
    args: Vec<String>,
    cwd: &Path,
    stdin: &str,
    timeout: Duration,
) -> CommandSpec {
    CommandSpec {
        program: program.into(),
        args,
        cwd: cwd.to_path_buf(),
        stdin: stdin.to_string(),
        timeout,
    }
}

fn run_first_available(candidates: Vec<CommandSpec>) -> Result<CommandOutput, String> {
    let mut not_found = Vec::new();
    for spec in candidates {
        match run_command(spec) {
            Ok(output) => return Ok(output),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                not_found.push(err.to_string());
            }
            Err(err) => return Err(err.to_string()),
        }
    }
    Err(format!("未找到运行命令：{}", not_found.join("；")))
}

fn run_command(spec: CommandSpec) -> std::io::Result<CommandOutput> {
    let command_label = if spec.args.is_empty() {
        spec.program.clone()
    } else {
        format!("{} {}", spec.program, spec.args.join(" "))
    };
    let started_at = Instant::now();
    let mut child = Command::new(&spec.program)
        .args(&spec.args)
        .current_dir(&spec.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    if let Some(mut stdin) = child.stdin.take() {
        if !spec.stdin.is_empty() {
            stdin.write_all(spec.stdin.as_bytes())?;
        }
    }

    let mut timed_out = false;
    loop {
        if child.try_wait()?.is_some() {
            break;
        }
        if started_at.elapsed() >= spec.timeout {
            timed_out = true;
            let _ = child.kill();
            break;
        }
        thread::sleep(Duration::from_millis(25));
    }

    let output = child.wait_with_output()?;
    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        duration_ms: started_at.elapsed().as_millis(),
        timed_out,
        command: command_label,
    })
}

fn output_to_response(output: CommandOutput) -> Result<RunCodeResponse, String> {
    let status = if output.timed_out {
        "timeout"
    } else if output.exit_code == Some(0) {
        "success"
    } else {
        "error"
    };
    Ok(RunCodeResponse {
        status: status.to_string(),
        stdout: output.stdout,
        stderr: output.stderr,
        exit_code: output.exit_code,
        duration_ms: output.duration_ms,
        command: output.command,
    })
}

fn create_workdir() -> Result<PathBuf, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| err.to_string())?
        .as_nanos();
    let dir = std::env::temp_dir().join(format!(
        "interview-buddy-run-{}-{}",
        std::process::id(),
        nanos
    ));
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

fn path_arg(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_code])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
