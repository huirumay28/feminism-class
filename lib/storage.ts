import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.warn('Redis environment variables not configured. Data persistence is disabled.');
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url,
      token,
    });
  }

  return redis;
}

export interface Highlight {
  id: string;
  weekNumber: number;
  text: string;
  color: string;
  startOffset: number;
  endOffset: number;
  chapterNumber?: number;
  note?: string;
  createdAt: number;
}

export interface ReadingNote {
  id: string;
  weekNumber: number;
  readingId: string;
  note: string;
  createdAt: number;
}

export interface Answer {
  id: string;
  weekNumber: number;
  itemId: string;
  itemType: 'discussion' | 'homework' | 'exercise';
  text: string;
  uploads?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ReadingCheck {
  weekNumber: number;
  readingId: string;
  checked: boolean;
  checkedAt?: number;
}

const STORAGE_KEYS = {
  highlights: 'highlights',
  readingNotes: 'reading-notes',
  answers: 'answers',
  readingChecks: 'reading-checks',
} as const;

export async function getHighlights(): Promise<Highlight[]> {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const data = await client.get<Highlight[]>(STORAGE_KEYS.highlights);
    return data || [];
  } catch (error) {
    console.error('Failed to get highlights:', error);
    return [];
  }
}

export async function saveHighlight(highlight: Highlight): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const highlights = await getHighlights();
    highlights.push(highlight);
    await client.set(STORAGE_KEYS.highlights, highlights);
  } catch (error) {
    console.error('Failed to save highlight:', error);
    throw error;
  }
}

export async function deleteHighlight(id: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const highlights = await getHighlights();
    const filtered = highlights.filter((h) => h.id !== id);
    await client.set(STORAGE_KEYS.highlights, filtered);
  } catch (error) {
    console.error('Failed to delete highlight:', error);
    throw error;
  }
}

export async function updateHighlightNote(id: string, note: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const highlights = await getHighlights();
    const highlight = highlights.find((h) => h.id === id);
    if (highlight) {
      highlight.note = note;
      await client.set(STORAGE_KEYS.highlights, highlights);
    }
  } catch (error) {
    console.error('Failed to update highlight note:', error);
    throw error;
  }
}

export async function getReadingNotes(): Promise<ReadingNote[]> {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const data = await client.get<ReadingNote[]>(STORAGE_KEYS.readingNotes);
    return data || [];
  } catch (error) {
    console.error('Failed to get reading notes:', error);
    return [];
  }
}

export async function saveReadingNote(note: ReadingNote): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const notes = await getReadingNotes();
    const existingIndex = notes.findIndex(
      (n) => n.weekNumber === note.weekNumber && n.readingId === note.readingId
    );

    if (existingIndex >= 0) {
      notes[existingIndex] = note;
    } else {
      notes.push(note);
    }

    await client.set(STORAGE_KEYS.readingNotes, notes);
  } catch (error) {
    console.error('Failed to save reading note:', error);
    throw error;
  }
}

export async function getAnswers(): Promise<Answer[]> {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const data = await client.get<Answer[]>(STORAGE_KEYS.answers);
    return data || [];
  } catch (error) {
    console.error('Failed to get answers:', error);
    return [];
  }
}

export async function saveAnswer(answer: Answer): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const answers = await getAnswers();
    const existingIndex = answers.findIndex((a) => a.id === answer.id);

    if (existingIndex >= 0) {
      answers[existingIndex] = answer;
    } else {
      answers.push(answer);
    }

    await client.set(STORAGE_KEYS.answers, answers);
  } catch (error) {
    console.error('Failed to save answer:', error);
    throw error;
  }
}

export async function getReadingChecks(): Promise<ReadingCheck[]> {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const data = await client.get<ReadingCheck[]>(STORAGE_KEYS.readingChecks);
    return data || [];
  } catch (error) {
    console.error('Failed to get reading checks:', error);
    return [];
  }
}

export async function saveReadingCheck(check: ReadingCheck): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const checks = await getReadingChecks();
    const existingIndex = checks.findIndex(
      (c) => c.weekNumber === check.weekNumber && c.readingId === check.readingId
    );

    if (existingIndex >= 0) {
      checks[existingIndex] = check;
    } else {
      checks.push(check);
    }

    await client.set(STORAGE_KEYS.readingChecks, checks);
  } catch (error) {
    console.error('Failed to save reading check:', error);
    throw error;
  }
}
