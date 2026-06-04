import type { AnalysisResult, Lexicon, Match, MatchCategory } from "../types";

export interface Token {
  word: string;
  start: number;
  end: number;
}

/** Words: letters/digits with optional internal hyphens. */
const WORD_RE = /\b[\w]+(?:-[\w]+)*\b/gu;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(WORD_RE.source, WORD_RE.flags);
  while ((match = re.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

function patternMatches(token: string, pattern: string): boolean {
  const t = token.toLowerCase();
  const p = pattern.toLowerCase().trim();
  if (!p) return false;
  if (p.endsWith("*")) {
    return t.startsWith(p.slice(0, -1));
  }
  return t === p;
}

function patternMatchLength(token: string, pattern: string): number {
  if (!patternMatches(token, pattern)) return 0;
  return token.length;
}

function bestCategoryForToken(
  token: string,
  lexicon: Lexicon,
): { category: MatchCategory; pattern: string; len: number } | null {
  let best: { category: MatchCategory; pattern: string; len: number } | null =
    null;

  const consider = (pattern: string, category: MatchCategory) => {
    const len = patternMatchLength(token, pattern);
    if (len === 0) return;
    if (!best || len > best.len) {
      best = { category, pattern, len };
    } else if (len === best.len && category === "masculine") {
      best = { category, pattern, len };
    }
  };

  for (const pattern of lexicon.masculine) consider(pattern, "masculine");
  for (const pattern of lexicon.feminine) consider(pattern, "feminine");

  return best;
}

export function analyzeText(bodyText: string, lexicon: Lexicon): AnalysisResult {
  const tokens = tokenize(bodyText);
  const matches: Match[] = [];
  let masculineCount = 0;
  let feminineCount = 0;

  for (const { word, start, end } of tokens) {
    const hit = bestCategoryForToken(word, lexicon);
    if (!hit) continue;

    matches.push({
      matchedText: word,
      category: hit.category,
      start,
      end,
      pattern: hit.pattern,
    });

    if (hit.category === "masculine") masculineCount += 1;
    else feminineCount += 1;
  }

  const totalWordCount = tokens.length;
  const masculinePercent =
    totalWordCount > 0 ? (masculineCount / totalWordCount) * 100 : 0;
  const femininePercent =
    totalWordCount > 0 ? (feminineCount / totalWordCount) * 100 : 0;

  return {
    totalWordCount,
    masculineCount,
    feminineCount,
    masculinePercent,
    femininePercent,
    matches,
    analyzedAt: new Date().toISOString(),
  };
}

export function formatPercent(n: number): string {
  return n.toFixed(1);
}
