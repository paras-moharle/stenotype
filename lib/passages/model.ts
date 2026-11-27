import { normalizeText } from '../typing/scoring';

export const categories = ['Legal', 'Professional', 'General'] as const;
export type PassageCategory = typeof categories[number];
export type Passage = ReturnType<typeof describePassage>;

function describePassage(category: PassageCategory, topic: string, text: string) {
  const words = text.split(/\s+/);
  const sentenceCount = (text.match(/[.!?](?=\s|$)/g) ?? []).length;
  const punctuation = (text.match(/[.,!?;:'"()-]/g) ?? []).length;
  const complexity = Number(words.filter(word => word.replace(/[^a-z]/gi, '').length >= 8).length / words.length >= .17)
    + Number(words.length / Math.max(1, sentenceCount) >= 19)
    + Number(punctuation / words.length >= .13)
    + Number(/\d|[A-Z]{2,}/.test(text));
  return {
    id: `${category.toLowerCase()}:${topic}`,
    category, topic, text, sentenceCount,
    source: 'original-fictional-practice' as const,
    wordCount: words.length,
    characterCount: normalizeText(text).length,
    punctuationDensity: punctuation / words.length,
    difficulty: complexity >= 2 ? 'Advanced' : complexity === 1 ? 'Standard' : 'Easy',
  };
}

export function definePassages(category: PassageCategory, entries: readonly (readonly [string, string])[]) {
  return entries.map(([topic, text]) => describePassage(category, topic, text));
}
