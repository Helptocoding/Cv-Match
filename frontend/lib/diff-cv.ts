import { diffWords as _diffWords } from "diff";


function wordTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-záéíóúñü\s]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
}

export function similarity(a: string, b: string): number {
  const ta = wordTokens(a);
  const tb = wordTokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}


export interface DiffToken {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export function wordDiff(a: string, b: string): DiffToken[] {
  if (!a && !b) return [];
  if (!a) return [{ value: b, added: true }];
  if (!b) return [{ value: a, removed: true }];
  return _diffWords(a, b) as DiffToken[];
}


export interface MatchedPair {
  originalIndex: number;
  adaptedIndex: number;
  original: string;
  adapted: string;
  similarity: number;
}

export type BulletMatch =
  | { kind: "paired"; pair: MatchedPair }
  | { kind: "new"; adapted: string; adaptedIndex: number }
  | { kind: "removed"; original: string; originalIndex: number };

const THRESHOLD = 0.4;

export function matchBullets(
  originalBullets: string[],
  adaptedBullets: string[],
): BulletMatch[] {
  const result: BulletMatch[] = [];
  const usedOriginals = new Set<number>();
  const usedAdapted = new Set<number>();

  for (let ai = 0; ai < adaptedBullets.length; ai++) {
    let bestIdx = -1;
    let bestSim = 0;
    for (let oi = 0; oi < originalBullets.length; oi++) {
      if (usedOriginals.has(oi)) continue;
      const sim = similarity(originalBullets[oi], adaptedBullets[ai]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = oi;
      }
    }
    if (bestIdx >= 0 && bestSim >= THRESHOLD) {
      usedOriginals.add(bestIdx);
      usedAdapted.add(ai);
      result.push({
        kind: "paired",
        pair: {
          originalIndex: bestIdx,
          adaptedIndex: ai,
          original: originalBullets[bestIdx],
          adapted: adaptedBullets[ai],
          similarity: bestSim,
        },
      });
    }
  }

  for (let ai = 0; ai < adaptedBullets.length; ai++) {
    if (!usedAdapted.has(ai)) {
      result.push({ kind: "new", adapted: adaptedBullets[ai], adaptedIndex: ai });
    }
  }

  for (let oi = 0; oi < originalBullets.length; oi++) {
    if (!usedOriginals.has(oi)) {
      result.push({ kind: "removed", original: originalBullets[oi], originalIndex: oi });
    }
  }

  return result;
}
