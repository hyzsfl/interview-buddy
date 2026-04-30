import problemsData from "@/data/problems.json";

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
  url: string;
  description: string; // HTML
}

export const ALL_PROBLEMS = problemsData as Problem[];

/**
 * Pick `count` problems, each from a different category, randomly.
 */
export function pickRandomProblems(count = 2): Problem[] {
  const byCategory = new Map<string, Problem[]>();
  for (const p of ALL_PROBLEMS) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }
  const categories = Array.from(byCategory.keys());
  if (categories.length < count) {
    throw new Error(
      `Need at least ${count} distinct categories, only have ${categories.length}`,
    );
  }
  // Shuffle categories
  for (let i = categories.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }
  const chosen: Problem[] = [];
  for (let i = 0; i < count; i++) {
    const cat = categories[i];
    const pool = byCategory.get(cat)!;
    chosen.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return chosen;
}
