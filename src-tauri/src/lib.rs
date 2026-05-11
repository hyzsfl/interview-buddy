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
            fs::write(&source, build_python_source(&request.code)).map_err(|err| err.to_string())?;
            let candidates = vec![
                command("python3", vec![path_arg(&source)], workdir, &request.stdin, RUN_TIMEOUT),
                command("python", vec![path_arg(&source)], workdir, &request.stdin, RUN_TIMEOUT),
            ];
            output_to_response(run_first_available(candidates)?)
        }
        "javascript" => {
            let source = workdir.join("main.js");
            fs::write(&source, build_javascript_source(&request.code)).map_err(|err| err.to_string())?;
            output_to_response(run_first_available(vec![command(
                "node",
                vec![path_arg(&source)],
                workdir,
                &request.stdin,
                RUN_TIMEOUT,
            )])?)
        }
        "java" => {
            let solution_source = workdir.join("Solution.java");
            let main_source = workdir.join("Main.java");
            fs::write(&solution_source, build_java_solution_source(&request.code))
                .map_err(|err| err.to_string())?;
            fs::write(&main_source, JAVA_LEETCODE_HARNESS).map_err(|err| err.to_string())?;
            let compile = run_first_available(vec![command(
                "javac",
                vec![path_arg(&solution_source), path_arg(&main_source)],
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
            fs::write(&source, build_cpp_source(&request.code)).map_err(|err| err.to_string())?;
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
            fs::write(&source, build_go_source(&request.code)).map_err(|err| err.to_string())?;
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
            fs::write(&source, build_rust_source(&request.code)).map_err(|err| err.to_string())?;
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

fn build_python_source(code: &str) -> String {
    format!(
        r#"{prelude}

{code}

{harness}
"#,
        prelude = PYTHON_LEETCODE_PRELUDE,
        code = code,
        harness = PYTHON_LEETCODE_HARNESS
    )
}

const PYTHON_LEETCODE_PRELUDE: &str = r#"
from __future__ import annotations
from typing import *
from collections import *
from functools import *
from itertools import *
from heapq import *
from bisect import *
import json
import math
import re
import sys

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
"#;

const PYTHON_LEETCODE_HARNESS: &str = r#"
def __interview_buddy_to_jsonable(value):
    if isinstance(value, ListNode):
        result = []
        seen = set()
        while value is not None and id(value) not in seen:
            seen.add(id(value))
            result.append(value.val)
            value = value.next
        return result
    if isinstance(value, TreeNode):
        result = []
        queue = deque([value])
        while queue:
            node = queue.popleft()
            if node is None:
                result.append(None)
                continue
            result.append(node.val)
            queue.append(node.left)
            queue.append(node.right)
        while result and result[-1] is None:
            result.pop()
        return result
    if isinstance(value, dict):
        return {str(k): __interview_buddy_to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [__interview_buddy_to_jsonable(item) for item in value]
    return value

def __interview_buddy_run_solution():
    raw_input = sys.stdin.read()
    if not raw_input.strip() or "Solution" not in globals():
        return

    payload = json.loads(raw_input)
    solution = Solution()
    methods = [
        name for name, value in Solution.__dict__.items()
        if not name.startswith("_") and callable(value)
    ]
    if not methods:
        raise RuntimeError("Solution 中没有可调用的公开方法")

    method = getattr(solution, methods[0])
    arg_count = max(method.__code__.co_argcount - 1, 0)
    if isinstance(payload, dict):
        result = method(**payload)
    elif arg_count == 1:
        result = method(payload)
    elif isinstance(payload, list):
        result = method(*payload)
    else:
        result = method(payload)

    print(json.dumps(__interview_buddy_to_jsonable(result), ensure_ascii=False))

if __name__ == "__main__":
    __interview_buddy_run_solution()
"#;

fn build_javascript_source(code: &str) -> String {
    format!(
        r#"{code}

{harness}
"#,
        code = code,
        harness = JAVASCRIPT_LEETCODE_HARNESS
    )
}

const JAVASCRIPT_LEETCODE_HARNESS: &str = r#"
async function __interviewBuddyRunSolution() {
  const fs = await import("node:fs");
  const rawInput = fs.readFileSync(0, "utf8");
  if (!rawInput.trim() || typeof Solution === "undefined") return;
  const solution = new Solution();
  const methodName = Object.getOwnPropertyNames(Solution.prototype)
    .find((name) => name !== "constructor" && typeof solution[name] === "function");
  if (!methodName) throw new Error("Solution 中没有可调用的公开方法");
  const method = solution[methodName].bind(solution);
  const payload = JSON.parse(rawInput);
  const args = method.length <= 1 ? [payload] : payload;
  const result = await method(...args);
  if (typeof result !== "undefined") {
    console.log(JSON.stringify(result));
  }
}

__interviewBuddyRunSolution();
"#;

fn build_java_solution_source(code: &str) -> String {
    format!("import java.util.*;\n\n{}", code)
}

const JAVA_LEETCODE_HARNESS: &str = r#"
import java.lang.reflect.*;
import java.util.*;

public class Main {
  public static void main(String[] args) throws Exception {
    String input = new String(System.in.readAllBytes());
    if (input.trim().isEmpty()) {
      return;
    }

    Object payload = new Parser(input).parse();
    Solution solution = new Solution();
    Method target = null;
    for (Method method : Solution.class.getDeclaredMethods()) {
      if (!method.getName().startsWith("_") && !method.getName().equals("main")) {
        target = method;
        break;
      }
    }
    if (target == null) {
      throw new RuntimeException("Solution 中没有可调用的公开方法");
    }
    target.setAccessible(true);

    Class<?>[] types = target.getParameterTypes();
    Object[] callArgs = new Object[types.length];
    if (payload instanceof Map<?, ?> map) {
      Parameter[] params = target.getParameters();
      for (int i = 0; i < types.length; i++) {
        callArgs[i] = convert(map.get(params[i].getName()), types[i]);
      }
    } else if (types.length == 1) {
      callArgs[0] = convert(payload, types[0]);
    } else {
      List<?> values = (List<?>) payload;
      for (int i = 0; i < types.length; i++) {
        callArgs[i] = convert(values.get(i), types[i]);
      }
    }

    Object result = target.invoke(solution, callArgs);
    if (target.getReturnType().equals(Void.TYPE)) {
      System.out.println(toJson(callArgs.length > 0 ? callArgs[0] : null));
    } else {
      System.out.println(toJson(result));
    }
  }

  static Object convert(Object value, Class<?> type) {
    if (value == null) return null;
    if (type.equals(String.class)) return String.valueOf(value);
    if (type.equals(int.class) || type.equals(Integer.class)) return ((Number) value).intValue();
    if (type.equals(long.class) || type.equals(Long.class)) return ((Number) value).longValue();
    if (type.equals(double.class) || type.equals(Double.class)) return ((Number) value).doubleValue();
    if (type.equals(boolean.class) || type.equals(Boolean.class)) return (Boolean) value;
    if (type.isArray()) {
      List<?> values = (List<?>) value;
      Class<?> itemType = type.getComponentType();
      Object array = Array.newInstance(itemType, values.size());
      for (int i = 0; i < values.size(); i++) {
        Array.set(array, i, convert(values.get(i), itemType));
      }
      return array;
    }
    return value;
  }

  static String toJson(Object value) {
    if (value == null) return "null";
    if (value instanceof String s) return quote(s);
    if (value instanceof Character c) return quote(String.valueOf(c));
    if (value instanceof Boolean || value instanceof Number) return String.valueOf(value);
    if (value.getClass().isArray()) {
      List<String> parts = new ArrayList<>();
      int size = Array.getLength(value);
      for (int i = 0; i < size; i++) parts.add(toJson(Array.get(value, i)));
      return "[" + String.join(",", parts) + "]";
    }
    if (value instanceof Iterable<?> iterable) {
      List<String> parts = new ArrayList<>();
      for (Object item : iterable) parts.add(toJson(item));
      return "[" + String.join(",", parts) + "]";
    }
    return quote(String.valueOf(value));
  }

  static String quote(String value) {
    return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
  }

  static class Parser {
    private final String source;
    private int index = 0;

    Parser(String source) {
      this.source = source;
    }

    Object parse() {
      skip();
      return value();
    }

    Object value() {
      skip();
      if (peek() == '"') return string();
      if (peek() == '[') return array();
      if (peek() == '{') return object();
      if (source.startsWith("true", index)) {
        index += 4;
        return true;
      }
      if (source.startsWith("false", index)) {
        index += 5;
        return false;
      }
      if (source.startsWith("null", index)) {
        index += 4;
        return null;
      }
      return number();
    }

    List<Object> array() {
      index++;
      List<Object> result = new ArrayList<>();
      skip();
      if (peek() == ']') {
        index++;
        return result;
      }
      while (true) {
        result.add(value());
        skip();
        if (peek() == ']') {
          index++;
          return result;
        }
        index++;
      }
    }

    Map<String, Object> object() {
      index++;
      Map<String, Object> result = new LinkedHashMap<>();
      skip();
      if (peek() == '}') {
        index++;
        return result;
      }
      while (true) {
        String key = string();
        skip();
        index++;
        result.put(key, value());
        skip();
        if (peek() == '}') {
          index++;
          return result;
        }
        index++;
      }
    }

    String string() {
      index++;
      StringBuilder result = new StringBuilder();
      while (index < source.length()) {
        char ch = source.charAt(index++);
        if (ch == '"') break;
        if (ch == '\\') {
          char escaped = source.charAt(index++);
          if (escaped == 'n') result.append('\n');
          else if (escaped == 't') result.append('\t');
          else result.append(escaped);
        } else {
          result.append(ch);
        }
      }
      return result.toString();
    }

    Number number() {
      int start = index;
      while (index < source.length() && "-0123456789.eE+".indexOf(source.charAt(index)) >= 0) {
        index++;
      }
      String raw = source.substring(start, index);
      if (raw.contains(".") || raw.contains("e") || raw.contains("E")) {
        return Double.parseDouble(raw);
      }
      long value = Long.parseLong(raw);
      return value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE ? (int) value : value;
    }

    char peek() {
      return index < source.length() ? source.charAt(index) : '\0';
    }

    void skip() {
      while (index < source.length() && Character.isWhitespace(source.charAt(index))) index++;
    }
  }
}
"#;

fn build_cpp_source(code: &str) -> String {
    let harness = find_cpp_solution_method(code)
        .map(|method| build_cpp_harness(&method))
        .unwrap_or_default();
    format!(
        r#"#include <algorithm>
#include <cctype>
#include <cmath>
#include <deque>
#include <functional>
#include <iostream>
#include <iterator>
#include <map>
#include <queue>
#include <set>
#include <stack>
#include <string>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
using namespace std;

struct ListNode {{
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {{}}
    ListNode(int x) : val(x), next(nullptr) {{}}
    ListNode(int x, ListNode *next) : val(x), next(next) {{}}
}};

struct TreeNode {{
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {{}}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {{}}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {{}}
}};

{code}

{support}

{harness}
"#,
        code = code,
        support = CPP_LEETCODE_SUPPORT,
        harness = harness
    )
}

struct CppMethod {
    name: String,
    return_type: String,
    param_types: Vec<String>,
}

fn find_cpp_solution_method(code: &str) -> Option<CppMethod> {
    let solution_start = code.find("class Solution")?;
    for raw_line in code[solution_start..].lines() {
        let line = raw_line.trim();
        if !line.contains('(') || !line.contains(')') || line.starts_with("class ") {
            continue;
        }
        if line.starts_with("if ") || line.starts_with("for ") || line.starts_with("while ") {
            continue;
        }
        let before_paren = line.split('(').next()?.trim();
        let mut words: Vec<&str> = before_paren.split_whitespace().collect();
        let name = words.pop()?.trim_matches('*').trim_matches('&');
        if name == "Solution" || name.starts_with('~') {
            continue;
        }
        let return_type = words.join(" ");
        let params = line.split('(').nth(1)?.split(')').next()?.trim();
        let param_types = parse_cpp_param_types(params);
        return Some(CppMethod {
            name: name.to_string(),
            return_type,
            param_types,
        });
    }
    None
}

fn parse_cpp_param_types(params: &str) -> Vec<String> {
    if params.is_empty() {
        return Vec::new();
    }
    params
        .split(',')
        .filter_map(|param| {
            let mut parts: Vec<&str> = param.trim().split_whitespace().collect();
            parts.pop()?;
            let ty = parts.join(" ").replace('&', "").replace("const ", "");
            Some(ty.trim().to_string())
        })
        .collect()
}

fn build_cpp_harness(method: &CppMethod) -> String {
    let arg_decls = method
        .param_types
        .iter()
        .enumerate()
        .map(|(index, ty)| {
            let source = if method.param_types.len() == 1 {
                "payload".to_string()
            } else {
                format!("payload.arr.at({})", index)
            };
            format!("    auto arg{index} = ib_convert<{ty}>({source});")
        })
        .collect::<Vec<_>>()
        .join("\n");
    let args = (0..method.param_types.len())
        .map(|index| format!("arg{}", index))
        .collect::<Vec<_>>()
        .join(", ");
    let call = if method.return_type.trim() == "void" {
        format!(
            "    solution.{name}({args});\n    cout << ib_to_json(arg0) << endl;",
            name = method.name,
            args = args
        )
    } else {
        format!(
            "    auto result = solution.{name}({args});\n    cout << ib_to_json(result) << endl;",
            name = method.name,
            args = args
        )
    };
    format!(
        r#"int main() {{
    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    if (input.find_first_not_of(" \t\r\n") == string::npos) return 0;
    auto payload = ib_parse_json(input);
    Solution solution;
{arg_decls}
{call}
    return 0;
}}"#,
        arg_decls = arg_decls,
        call = call
    )
}

const CPP_LEETCODE_SUPPORT: &str = r#"
struct IbJson {
    enum Kind { Null, Bool, Number, String, Array } kind = Null;
    bool boolean = false;
    double number = 0;
    string str;
    vector<IbJson> arr;
};

struct IbParser {
    string s;
    size_t i = 0;
    explicit IbParser(string source) : s(std::move(source)) {}
    void skip() { while (i < s.size() && isspace(static_cast<unsigned char>(s[i]))) i++; }
    IbJson value() {
        skip();
        if (s[i] == '"') return string_value();
        if (s[i] == '[') return array_value();
        if (s.compare(i, 4, "true") == 0) { i += 4; IbJson v; v.kind = IbJson::Bool; v.boolean = true; return v; }
        if (s.compare(i, 5, "false") == 0) { i += 5; IbJson v; v.kind = IbJson::Bool; return v; }
        if (s.compare(i, 4, "null") == 0) { i += 4; return IbJson(); }
        return number_value();
    }
    IbJson array_value() {
        i++;
        IbJson v; v.kind = IbJson::Array;
        skip();
        if (s[i] == ']') { i++; return v; }
        while (true) {
            v.arr.push_back(value());
            skip();
            if (s[i] == ']') { i++; return v; }
            i++;
        }
    }
    IbJson string_value() {
        i++;
        IbJson v; v.kind = IbJson::String;
        while (i < s.size()) {
            char ch = s[i++];
            if (ch == '"') break;
            if (ch == '\\' && i < s.size()) {
                char escaped = s[i++];
                if (escaped == 'n') v.str.push_back('\n');
                else if (escaped == 't') v.str.push_back('\t');
                else v.str.push_back(escaped);
            } else {
                v.str.push_back(ch);
            }
        }
        return v;
    }
    IbJson number_value() {
        size_t start = i;
        while (i < s.size() && string("-0123456789.eE+").find(s[i]) != string::npos) i++;
        IbJson v; v.kind = IbJson::Number; v.number = stod(s.substr(start, i - start)); return v;
    }
};

IbJson ib_parse_json(const string& input) {
    return IbParser(input).value();
}

template <typename T>
T ib_convert(const IbJson& value);

template <>
int ib_convert<int>(const IbJson& value) { return static_cast<int>(value.number); }

template <>
long long ib_convert<long long>(const IbJson& value) { return static_cast<long long>(value.number); }

template <>
string ib_convert<string>(const IbJson& value) { return value.str; }

template <>
bool ib_convert<bool>(const IbJson& value) { return value.boolean; }

template <typename T>
vector<T> ib_convert(const IbJson& value) {
    vector<T> result;
    for (const auto& item : value.arr) result.push_back(ib_convert<T>(item));
    return result;
}

string ib_to_json(const string& value) {
    string out = "\"";
    for (char ch : value) {
        if (ch == '"' || ch == '\\') out.push_back('\\');
        out.push_back(ch);
    }
    out.push_back('"');
    return out;
}

string ib_to_json(const char* value) { return ib_to_json(string(value)); }
string ib_to_json(bool value) { return value ? "true" : "false"; }

template <typename T, typename enable_if<is_arithmetic<T>::value, int>::type = 0>
string ib_to_json(T value) { return to_string(value); }

template <typename T>
string ib_to_json(const vector<T>& value) {
    string out = "[";
    for (size_t i = 0; i < value.size(); i++) {
        if (i) out += ",";
        out += ib_to_json(value[i]);
    }
    out += "]";
    return out;
}
"#;

fn build_go_source(code: &str) -> String {
    let harness = find_go_solution_function(code)
        .map(|function| build_go_harness(&function))
        .unwrap_or_default();
    if code.trim_start().starts_with("package ") {
        format!("{code}\n\n{harness}")
    } else {
        format!(
            r#"package main

import (
    "encoding/json"
    "fmt"
    "os"
)

{code}

{harness}
"#,
            code = code,
            harness = harness
        )
    }
}

struct GoFunction {
    name: String,
    param_types: Vec<String>,
    has_return: bool,
}

fn find_go_solution_function(code: &str) -> Option<GoFunction> {
    for raw_line in code.lines() {
        let line = raw_line.trim();
        if !line.starts_with("func ") || line.starts_with("func main(") {
            continue;
        }
        let name_start = "func ".len();
        let name_end = line[name_start..].find('(')? + name_start;
        let name = line[name_start..name_end].trim().to_string();
        let params = line.split('(').nth(1)?.split(')').next()?.trim();
        let rest = line.split(')').nth(1).unwrap_or("").trim();
        return Some(GoFunction {
            name,
            param_types: parse_go_param_types(params),
            has_return: !rest.is_empty() && !rest.starts_with('{'),
        });
    }
    None
}

fn parse_go_param_types(params: &str) -> Vec<String> {
    if params.is_empty() {
        return Vec::new();
    }
    params
        .split(',')
        .filter_map(|param| {
            let parts: Vec<&str> = param.trim().split_whitespace().collect();
            parts.last().map(|ty| (*ty).to_string())
        })
        .collect()
}

fn build_go_harness(function: &GoFunction) -> String {
    let arg_decls = function
        .param_types
        .iter()
        .enumerate()
        .map(|(index, ty)| {
            if function.param_types.len() == 1 {
                format!(
                    "    var arg{index} {ty}\n    if err := json.Unmarshal(data, &arg{index}); err != nil {{ panic(err) }}"
                )
            } else {
                format!(
                    "    var arg{index} {ty}\n    if err := json.Unmarshal(rawArgs[{index}], &arg{index}); err != nil {{ panic(err) }}"
                )
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    let args = (0..function.param_types.len())
        .map(|index| format!("arg{}", index))
        .collect::<Vec<_>>()
        .join(", ");
    let raw_args = if function.param_types.len() > 1 {
        "    var rawArgs []json.RawMessage\n    if err := json.Unmarshal(data, &rawArgs); err != nil { panic(err) }\n"
    } else {
        ""
    };
    let call = if function.has_return {
        format!(
            "    result := {name}({args})\n    output, _ := json.Marshal(result)\n    fmt.Println(string(output))",
            name = function.name,
            args = args
        )
    } else {
        format!(
            "    {name}({args})\n    output, _ := json.Marshal(arg0)\n    fmt.Println(string(output))",
            name = function.name,
            args = args
        )
    };
    format!(
        r#"func main() {{
    data, err := os.ReadFile("/dev/stdin")
    if err != nil {{ panic(err) }}
    if len(string(data)) == 0 {{
        return
    }}
{raw_args}{arg_decls}
{call}
}}"#,
        raw_args = raw_args,
        arg_decls = arg_decls,
        call = call
    )
}

fn build_rust_source(code: &str) -> String {
    let needs_solution = !code.contains("struct Solution");
    format!(
        r#"use std::collections::*;

{solution}

{code}
"#,
        solution = if needs_solution { "pub struct Solution;" } else { "" },
        code = code
    )
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
