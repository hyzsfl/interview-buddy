/**
 * One-shot script: fetch ~40 LeetCode "Hot 100" Medium problems from doocs/leetcode,
 * extract Chinese title + difficulty + tags + HTML description, write to src/data/problems.json.
 *
 * Run with: bun scripts/build-problems.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Curated subset of LeetCode 热题100 Medium problems, chosen to cover diverse categories.
// Each entry: [problem id, leetcode slug, our category label]
const PROBLEMS: Array<[number, string, string]> = [
  // 哈希表 / 数组
  [1, "two-sum", "数组"], // Easy actually — drop later if needed
  [49, "group-anagrams", "哈希表"],
  [128, "longest-consecutive-sequence", "哈希表"],
  // 双指针
  [15, "3sum", "双指针"],
  [11, "container-with-most-water", "双指针"],
  [42, "trapping-rain-water", "双指针"],
  // 滑动窗口
  [3, "longest-substring-without-repeating-characters", "滑动窗口"],
  [438, "find-all-anagrams-in-a-string", "滑动窗口"],
  // 子串
  [560, "subarray-sum-equals-k", "前缀和"],
  // 普通数组
  [53, "maximum-subarray", "动态规划"],
  [56, "merge-intervals", "数组"],
  [189, "rotate-array", "数组"],
  [238, "product-of-array-except-self", "数组"],
  // 矩阵
  [73, "set-matrix-zeroes", "矩阵"],
  [54, "spiral-matrix", "矩阵"],
  [48, "rotate-image", "矩阵"],
  [240, "search-a-2d-matrix-ii", "矩阵"],
  // 链表
  [2, "add-two-numbers", "链表"],
  [19, "remove-nth-node-from-end-of-list", "链表"],
  [24, "swap-nodes-in-pairs", "链表"],
  [142, "linked-list-cycle-ii", "链表"],
  [148, "sort-list", "链表"],
  [138, "copy-list-with-random-pointer", "链表"],
  // 二叉树
  [102, "binary-tree-level-order-traversal", "二叉树"],
  [105, "construct-binary-tree-from-preorder-and-inorder-traversal", "二叉树"],
  [114, "flatten-binary-tree-to-linked-list", "二叉树"],
  [199, "binary-tree-right-side-view", "二叉树"],
  [236, "lowest-common-ancestor-of-a-binary-tree", "二叉树"],
  // 二叉搜索树
  [98, "validate-binary-search-tree", "二叉搜索树"],
  [230, "kth-smallest-element-in-a-bst", "二叉搜索树"],
  // 图 / BFS
  [200, "number-of-islands", "图论"],
  [994, "rotting-oranges", "图论"],
  [207, "course-schedule", "图论"],
  // 回溯
  [46, "permutations", "回溯"],
  [78, "subsets", "回溯"],
  [39, "combination-sum", "回溯"],
  [22, "generate-parentheses", "回溯"],
  [79, "word-search", "回溯"],
  // 二分查找
  [33, "search-in-rotated-sorted-array", "二分查找"],
  [34, "find-first-and-last-position-of-element-in-sorted-array", "二分查找"],
  [153, "find-minimum-in-rotated-sorted-array", "二分查找"],
  // 栈
  [155, "min-stack", "栈"],
  [394, "decode-string", "栈"],
  [739, "daily-temperatures", "栈"],
  // 堆
  [215, "kth-largest-element-in-an-array", "堆"],
  [347, "top-k-frequent-elements", "堆"],
  // 贪心
  [55, "jump-game", "贪心"],
  [45, "jump-game-ii", "贪心"],
  [763, "partition-labels", "贪心"],
  // 动态规划
  [62, "unique-paths", "动态规划"],
  [64, "minimum-path-sum", "动态规划"],
  [5, "longest-palindromic-substring", "动态规划"],
  [300, "longest-increasing-subsequence", "动态规划"],
  [322, "coin-change", "动态规划"],
  [139, "word-break", "动态规划"],
  [152, "maximum-product-subarray"  , "动态规划"],
  // 多维DP
  [1143, "longest-common-subsequence", "动态规划"],
  // 技巧
  [136, "single-number", "位运算"], // Easy actually
  [287, "find-the-duplicate-number", "技巧"],
  [31, "next-permutation", "技巧"],
  [75, "sort-colors", "技巧"],
];

// Map id -> folder bucket "0000-0099", "0100-0199", etc.
function bucketFor(id: number): string {
  const lo = Math.floor((id - 1) / 100) * 100 + 1 - 1; // e.g., 3 -> 0
  const start = Math.max(0, Math.floor((id - 1) / 100) * 100);
  const end = start + 99;
  const pad = (n: number) => n.toString().padStart(4, "0");
  return `${pad(start === 0 ? 0 : start)}-${pad(end)}`;
  void lo;
}

// Fetch the folder listing so we can locate the exact folder name (it includes the English title).
async function findFolderName(id: number): Promise<string | null> {
  const bucket = bucketFor(id);
  const apiUrl = `https://api.github.com/repos/doocs/leetcode/contents/solution/${bucket}`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "lovable-build-script" },
  });
  if (!res.ok) {
    console.error(`Failed to list ${bucket}: ${res.status}`);
    return null;
  }
  const items = (await res.json()) as Array<{ name: string; type: string }>;
  const padded = id.toString().padStart(4, "0") + ".";
  const match = items.find((i) => i.type === "dir" && i.name.startsWith(padded));
  return match ? match.name : null;
}

interface ParsedReadme {
  title: string;
  difficulty: string;
  tags: string[];
  description: string; // HTML
}

function parseReadme(md: string): ParsedReadme | null {
  // Frontmatter
  const fm = md.match(/^---\n([\s\S]*?)\n---/);
  let difficulty = "";
  const tags: string[] = [];
  if (fm) {
    const fmBody = fm[1];
    const diffMatch = fmBody.match(/difficulty:\s*(.+)/);
    if (diffMatch) difficulty = diffMatch[1].trim();
    const tagSection = fmBody.match(/tags:\n((?:\s*-\s*.+\n?)+)/);
    if (tagSection) {
      for (const line of tagSection[1].split("\n")) {
        const t = line.match(/^\s*-\s*(.+)$/);
        if (t) tags.push(t[1].trim());
      }
    }
  }
  // Title
  const titleMatch = md.match(/^#\s*\[(\d+)\.\s*([^\]]+)\]/m);
  const title = titleMatch ? titleMatch[2].trim() : "";

  // Description block
  const descMatch = md.match(/<!-- description:start -->([\s\S]*?)<!-- description:end -->/);
  if (!descMatch) return null;
  const description = descMatch[1].trim();

  return { title, difficulty, tags, description };
}

async function main() {
  const out: any[] = [];
  for (const [id, slug, category] of PROBLEMS) {
    process.stdout.write(`[${id}] ${slug} ... `);
    const folder = await findFolderName(id);
    if (!folder) {
      console.log("NO FOLDER");
      continue;
    }
    const bucket = bucketFor(id);
    const url = `https://raw.githubusercontent.com/doocs/leetcode/main/solution/${bucket}/${encodeURIComponent(folder)}/README.md`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`FETCH FAIL ${res.status}`);
      continue;
    }
    const md = await res.text();
    const parsed = parseReadme(md);
    if (!parsed) {
      console.log("PARSE FAIL");
      continue;
    }
    if (parsed.difficulty !== "中等") {
      console.log(`SKIP (${parsed.difficulty})`);
      continue;
    }
    out.push({
      id: String(id),
      slug,
      title: parsed.title,
      difficulty: "Medium",
      category,
      tags: parsed.tags,
      url: `https://leetcode.cn/problems/${slug}/`,
      description: parsed.description,
    });
    console.log("OK");
    // Be polite to GitHub
    await new Promise((r) => setTimeout(r, 80));
  }

  const outPath = "src/data/problems.json";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✓ Wrote ${out.length} problems to ${outPath}`);

  // Print category distribution
  const counts: Record<string, number> = {};
  for (const p of out) counts[p.category] = (counts[p.category] || 0) + 1;
  console.log("Categories:", counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
