import { youtubeWatchUrl } from './youtube';

export const catalogFields = {
  id: true, title: true, category: true, youtubeId: true, durationSeconds: true,
} as const;

export const catalogCategories = ['GENERAL', 'PROFESSIONAL', 'LEGAL'] as const;
export type DictationMetadata = {
  id: string;
  title: string;
  category: string;
  youtubeId: string | null;
  durationSeconds: number | null;
};

export const validDictationId = (value: string) => /^[A-Za-z0-9_-]{1,80}$/.test(value);

export function dictationMetadata(item: DictationMetadata) {
  const category = item.category.charAt(0) + item.category.slice(1).toLowerCase();
  const seconds = item.durationSeconds;
  if (!youtubeWatchUrl(item.youtubeId) || seconds === null || !Number.isSafeInteger(seconds) || seconds <= 0) return category;
  return `${category} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} recording`;
}
