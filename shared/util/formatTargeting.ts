import { type Classification, classificationGroups } from "../data.ts";

const classificationLabels: Record<Classification, string> = {
  ally: "ally",
  enemy: "enemy",
  neutral: "neutral",
  structure: "structure",
  unit: "unit",
  tree: "tree",
  ward: "ward",
  self: "self",
  other: "another",
  spirit: "spirit",
  notSpirit: "non-spirit",
};

const noArticleLabels = new Set(["another"]);
const useALabels = new Set(["unit"]);

const classificationToGroup = Object.fromEntries(
  Object.entries(classificationGroups).flatMap(([group, classifications]) =>
    classifications.map((c) => [c, group])
  ),
) as Record<Classification, keyof typeof classificationGroups>;

const orFormatter = new Intl.ListFormat("en", { type: "disjunction" });

const formatClassificationGroup = (
  classifications: readonly Classification[],
): string => {
  const labels = classifications.map((c) => classificationLabels[c] ?? c);
  return orFormatter.format(labels);
};

export const formatTargeting = (
  targeting: ReadonlyArray<ReadonlyArray<Classification>>,
): string => {
  if (!targeting.length) return "Invalid target";

  const parts = targeting.map((group) => {
    const byGroup = new Map<string, Classification[]>();
    for (const c of group) {
      const g = classificationToGroup[c];
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(c);
    }

    const groupParts: string[] = [];
    for (const classifications of byGroup.values()) {
      groupParts.push(formatClassificationGroup(classifications));
    }
    return groupParts.join(" ");
  });

  const partsWithArticles = parts.map((p) => {
    if (noArticleLabels.has(p)) return p;
    const firstWord = p.split(" ")[0];
    if (useALabels.has(firstWord)) return `a ${p}`;
    return /^[aeiou]/i.test(p) ? `an ${p}` : `a ${p}`;
  });

  return `Must target ${orFormatter.format(partsWithArticles)}`;
};
