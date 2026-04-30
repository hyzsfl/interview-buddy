## 目标

零后端单页应用，用于现场面试开发工程师。每次面试随机抽 2 道**不同分类**的 LeetCode 热题100 中等题，面试者用任意语言（含伪代码）作答，提交后浏览器自动下载 JSON 文件，你再把文件喂给 AI 评分。

---

## 一、题库设计

### 数据来源
构建时从 `doocs/leetcode`（GitHub 上权威的中文 LeetCode 题解库）抓取热题100中等难度的题面 Markdown，整理成 `src/data/problems.json`。**运行时完全离线**。

### 文件结构（单文件）
`src/data/problems.json`：

```json
[
  {
    "id": "3",
    "slug": "longest-substring-without-repeating-characters",
    "title": "无重复字符的最长子串",
    "difficulty": "Medium",
    "category": "滑动窗口",
    "tags": ["哈希表", "字符串", "滑动窗口"],
    "url": "https://leetcode.cn/problems/longest-substring-without-repeating-characters/",
    "description": "## 题目描述\n\n给定一个字符串 s ...\n\n**示例 1：**\n\n输入：s = \"abcabcbb\"\n输出：3\n..."
  }
]
```

`description` 是完整 Markdown（题面 + 示例 + 约束），前端用 `react-markdown` 渲染。

### 分类覆盖
首批内置约 **40 道**热题100中等题，覆盖 10+ 分类：数组、哈希表、双指针、滑动窗口、字符串、链表、二叉树、图/BFS、回溯、动态规划、贪心、栈、堆、二分查找。

### 抽题算法
1. 按 `category` 分组
2. 随机选 2 个**不同**的 category
3. 每个 category 内随机抽 1 道

### 后续维护
直接编辑 `src/data/problems.json` 即可增删改。

---

## 二、作答存储

**纯浏览器下载，零后端。** 提交时构造 JSON Blob 触发下载，同时复制到剪贴板兜底。

### 文件命名
`interview-{姓名}-{岗位}-{YYYYMMDD-HHmm}.json`

### 文件结构（为 AI 评分优化）

```json
{
  "meta": {
    "candidateName": "张三",
    "position": "后端工程师",
    "interviewDate": "2026-04-30T14:30:00+08:00",
    "totalDurationSeconds": 2640
  },
  "answers": [
    {
      "problemId": "3",
      "title": "无重复字符的最长子串",
      "category": "滑动窗口",
      "difficulty": "Medium",
      "url": "https://leetcode.cn/...",
      "problemDescription": "## 题目描述\n...",
      "language": "python",
      "code": "def lengthOfLongestSubstring(s):\n    ...",
      "timeSpentSeconds": 1320,
      "submittedAt": "2026-04-30T14:52:00+08:00"
    }
  ]
}
```

> 题面原文一并写入，AI 评分时无需再查题。

---

## 三、页面流程

```text
/                  欢迎页：填写姓名 + 岗位 → "开始面试"
/interview         面试页：左右两栏（题目 + Monaco 编辑器）
/done              完成页：显示已下载文件名，按钮"开始新面试"
```

### 面试页交互
- **顶部固定栏**：候选人姓名 · 岗位 · 总计时器 · "提交全部"按钮
- **左栏**：Tab 切换两道题，Markdown 渲染题面
- **右栏**：Monaco 编辑器 + 语言下拉（Python/Java/C++/JS/TS/Go/伪代码）
- **每题独立计时**：切走暂停当前题计时
- **提交确认**：弹窗显示各题已写行数，防止误点
- **本地草稿**：实时写入 `localStorage`，刷新可恢复

---

## 四、技术细节

- **路由**：TanStack Start 文件路由 — `/`, `/interview`, `/done`
- **编辑器**：`@monaco-editor/react`
- **Markdown**：`react-markdown` + `remark-gfm`
- **状态**：单个 React Context 持有面试 session
- **持久化**：`localStorage` 草稿，提交后清除
- **题库构建**：`scripts/build-problems.ts` 一次性脚本，从 doocs/leetcode 抓取后写入 `src/data/problems.json`，提交进 git

### 文件清单
```text
scripts/build-problems.ts              一次性抓题脚本
src/data/problems.json                 题库
src/lib/problems.ts                    抽题/分类逻辑
src/lib/interview-storage.ts           草稿 + 下载逻辑
src/components/CodeEditor.tsx          Monaco 封装
src/components/ProblemView.tsx         Markdown 渲染
src/components/InterviewTimer.tsx      计时器
src/context/InterviewContext.tsx       面试状态
src/routes/index.tsx                   欢迎页
src/routes/interview.tsx               面试页
src/routes/done.tsx                    完成页
```

---

## 五、不在本期范围

- 不内置 AI 评分（你拿到 JSON 后自行调用）
- 不做用户系统/历史记录
- 不做代码运行/判题
- 不做管理后台（直接编辑 JSON）