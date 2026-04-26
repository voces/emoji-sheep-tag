import React from "react";
import { styled } from "styled-components";

const Highlight = styled.span`
  color: ${({ theme }) => theme.accent.DEFAULT};
`;

/** Strips diacritics and lowercases, locale-aware. */
export const fold = (s: string): string =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();

const isWordBoundary = (text: string, i: number): boolean => {
  if (i === 0) return true;
  const prev = text[i - 1];
  const cur = text[i];
  if (!/[\p{L}\p{N}]/u.test(prev)) return true;
  if (prev === prev.toLocaleLowerCase() && cur === cur.toLocaleUpperCase()) {
    return true;
  }
  return false;
};

/**
 * Returns a positive score if `query` is a subsequence of `text`, else null.
 * Higher scores = better matches. Rewards: prefix, word boundaries, contiguous
 * runs, earliness. Penalizes: gaps and length of unmatched text.
 *
 * Diacritic-insensitive ("cafe" matches "café") and code-point safe (an emoji
 * or supplementary-plane char counts as one query unit). Folds ICU-style.
 */
export const fuzzyScore = (text: string, query: string): number | null => {
  if (!query) return 0;
  const foldedText = fold(text);
  const queryChars = [...fold(query)];

  let textIdx = 0;
  let score = 0;
  let runLen = 0;
  let firstMatch = -1;

  for (const ch of queryChars) {
    const found = foldedText.indexOf(ch, textIdx);
    if (found === -1) return null;

    if (firstMatch === -1) firstMatch = found;

    if (found === textIdx) {
      runLen++;
      score += 5 + runLen * 2;
    } else {
      runLen = 1;
      score += 1;
      score -= Math.min(found - textIdx, 10);
    }

    if (isWordBoundary(text, found)) score += 8;
    if (found === 0) score += 15;

    textIdx = found + ch.length;
  }

  score -= Math.min(firstMatch, 20);
  score -= Math.max(0, foldedText.length - queryChars.length) * 0.1;

  return score;
};

/**
 * Wraps each char of `text` that participates in a fuzzy-subsequence match for
 * `query` in a `<Highlight>` span. Diacritic-insensitive and code-point safe.
 * Returns the original text unsplit if `query` doesn't match.
 */
export const highlightText = (
  text: string,
  query: string,
): (string | React.JSX.Element)[] => {
  const queryChars = [...fold(query)];
  if (!queryChars.length) return [text];

  const textChars = [...text];
  const foldedTextChars = textChars.map(fold);

  const matched = new Array<boolean>(textChars.length).fill(false);
  let qi = 0;
  for (let ti = 0; ti < textChars.length && qi < queryChars.length; ti++) {
    if (foldedTextChars[ti].includes(queryChars[qi])) {
      matched[ti] = true;
      qi++;
    }
  }
  if (qi < queryChars.length) return [text];

  const result: (string | React.JSX.Element)[] = [];
  let buffer = "";
  for (let ti = 0; ti < textChars.length; ti++) {
    if (matched[ti]) {
      if (buffer) {
        result.push(buffer);
        buffer = "";
      }
      result.push(
        <Highlight key={ti}>{textChars[ti]}</Highlight>,
      );
    } else {
      buffer += textChars[ti];
    }
  }
  if (buffer) result.push(buffer);
  return result;
};
