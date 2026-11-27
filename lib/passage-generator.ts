import { categories, type Passage, type PassageCategory } from './passages/model';

const loaders = {
  Legal: () => import('./passages/legal'),
  Professional: () => import('./passages/professional'),
  General: () => import('./passages/general'),
};
export const HISTORY_KEY = 'stenotype:passages:v1';
const HISTORY_LIMIT = 18;

export function readPassageHistory(storage?: Pick<Storage, 'getItem'>): string[] {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(HISTORY_KEY);
    const data: unknown = raw && raw.length <= 3000 ? JSON.parse(raw) : [];
    return Array.isArray(data)
      ? Array.from(new Set(data.filter((item): item is string =>
          typeof item === 'string' && /^(legal|professional|general):[a-z-]{1,48}$/.test(item))))
          .slice(0, HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function rememberPassage(id: string, history: readonly string[], storage?: Pick<Storage, 'setItem'>) {
  const next = [id, ...history.filter(previous => previous !== id)].slice(0, HISTORY_LIMIT);
  try {
    (storage ?? globalThis.localStorage)?.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // In-memory rotation still works with storage blocked.
  }
  return next;
}

export const timedCharacters = (seconds: number) => Math.ceil(seconds * 20);

export function selectPassage(
  pool: readonly Passage[],
  { history = [], previousId, seconds = 0, random = Math.random }: {
    history?: readonly string[];
    previousId?: string;
    seconds?: number;
    random?: () => number;
  } = {},
): Passage {
  const eligible = pool.filter(item => item.characterCount >= timedCharacters(seconds));
  if (!eligible.length) throw new Error('No passage fits the selected time limit.');
  const alternatives = eligible.filter(item => item.id !== previousId);
  const candidates = alternatives.length ? alternatives : eligible;
  const unseen = candidates.filter(item => !history.includes(item.id));
  if (unseen.length) return unseen[Math.floor(random() * unseen.length)];
  return candidates.reduce((oldest, item) =>
    history.indexOf(item.id) > history.indexOf(oldest.id) ? item : oldest);
}

export function seededRandom(seed: number) {
  if (!Number.isFinite(seed)) throw new RangeError('Passage seed must be finite.');
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export async function generatePassage(options: {
  category?: PassageCategory | 'mixed';
  history?: readonly string[];
  previousId?: string;
  seconds?: number;
  seed?: number;
} = {}): Promise<Passage> {
  const { category = 'mixed', history = [], seed } = options;
  const random = seed === undefined ? Math.random : seededRandom(seed);
  const choices = categories.filter(item => item === category || category === 'mixed');
  if (!choices.length) throw new RangeError('Unknown passage category.');
  const prior = (item: PassageCategory) => history.findIndex(id => id.startsWith(item.toLowerCase() + ':'));
  const unused = choices.filter(item => prior(item) === -1);
  const chosen = unused.length
    ? unused[Math.floor(random() * unused.length)]
    : choices.reduce((oldest, item) => prior(item) > prior(oldest) ? item : oldest);
  return selectPassage((await loaders[chosen]()).passages, { ...options, random });
}

export function practiceReference(source: string, length: 'full' | 'short', seconds = 0): string {
  if (length === 'short') return source.trim().split(/\s+/).slice(0, 30).join(' ');
  if (!seconds) return source;
  const target = timedCharacters(seconds);
  for (const sentence of source.matchAll(/[.!?](?=\s|$)/g)) {
    const end = sentence.index + 1;
    if (end >= target) return source.slice(0, end);
  }
  return source;
}
