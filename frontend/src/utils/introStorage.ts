/**
 * Versioned intro (yes/no landing) persistence. Survives app updates by using a single
 * canonical key while migrating legacy keys once. Historical aggregates still come from GET /intro-stats.
 */

const CANONICAL_KEY = 'chon_intro_state_v1';

export type IntroLocalTallies = { yes: number; no: number };

export type IntroPersisted = {
  hasChosen: boolean;
  tallies: IntroLocalTallies;
  /** Last button choice for this browser (yes/no) */
  lastChoice: string | null;
};

const defaultState = (): IntroPersisted => ({
  hasChosen: false,
  tallies: { yes: 0, no: 0 },
  lastChoice: null
});

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLegacyMirrors(state: IntroPersisted): void {
  try {
    localStorage.setItem('introLocalChoices', JSON.stringify(state.tallies));
    localStorage.setItem('introUserHasChosen', state.hasChosen ? 'true' : 'false');
    if (state.lastChoice) {
      localStorage.setItem('introChoice', state.lastChoice);
      localStorage.setItem('chon_personality_user_choice', state.lastChoice);
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Merge legacy keys into canonical storage when canonical is missing or strictly weaker
 * than legacy (e.g. after an app update wrote an empty v1 blob before legacy was read).
 */
export function migrateLegacyIntroIfNeeded(): void {
  if (typeof window === 'undefined') return;

  const current = safeParse<IntroPersisted | null>(localStorage.getItem(CANONICAL_KEY), null);
  const talliesLegacy = safeParse<IntroLocalTallies | null>(localStorage.getItem('introLocalChoices'), null);
  const hasChosenLegacy = localStorage.getItem('introUserHasChosen') === 'true';
  const lastChoiceLegacy =
    localStorage.getItem('introChoice') ||
    localStorage.getItem('chon_personality_user_choice') ||
    null;

  const sumT = (t: IntroLocalTallies | null | undefined) => (t?.yes ?? 0) + (t?.no ?? 0);

  if (
    current &&
    typeof current.hasChosen === 'boolean' &&
    current.tallies &&
    current.hasChosen === hasChosenLegacy &&
    sumT(current.tallies) >= sumT(talliesLegacy) &&
    (current.lastChoice || null) === (lastChoiceLegacy || null)
  ) {
    return;
  }

  const baseTallies = current?.tallies && typeof current.tallies.yes === 'number'
    ? current.tallies
    : { yes: 0, no: 0 };
  const fromLegacy = talliesLegacy && typeof talliesLegacy.yes === 'number' ? talliesLegacy : { yes: 0, no: 0 };
  const mergedTallies: IntroLocalTallies = {
    yes: Math.max(baseTallies.yes, fromLegacy.yes),
    no: Math.max(baseTallies.no, fromLegacy.no)
  };

  const merged: IntroPersisted = {
    hasChosen: Boolean(current?.hasChosen) || hasChosenLegacy || mergedTallies.yes + mergedTallies.no > 0,
    tallies: mergedTallies,
    lastChoice: lastChoiceLegacy || current?.lastChoice || null
  };

  try {
    localStorage.setItem(CANONICAL_KEY, JSON.stringify(merged));
    writeLegacyMirrors(merged);
  } catch {
    return;
  }
}

export function readIntroPersisted(): IntroPersisted {
  migrateLegacyIntroIfNeeded();
  const parsed = safeParse<IntroPersisted | null>(localStorage.getItem(CANONICAL_KEY), null);
  if (parsed && typeof parsed.hasChosen === 'boolean' && parsed.tallies) {
    return parsed;
  }
  return defaultState();
}

export function writeIntroPersisted(partial: Partial<IntroPersisted>): IntroPersisted {
  const prev = readIntroPersisted();
  const next: IntroPersisted = {
    ...prev,
    ...partial,
    tallies: partial.tallies
      ? { ...prev.tallies, ...partial.tallies }
      : prev.tallies
  };
  try {
    localStorage.setItem(CANONICAL_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  writeLegacyMirrors(next);
  return next;
}

/** Clears intro *session* when the user explicitly starts the test (Begin). Does not touch server history. */
export function clearIntroClientStateForBeginTest(): void {
  const empty = defaultState();
  try {
    localStorage.setItem(CANONICAL_KEY, JSON.stringify(empty));
    localStorage.removeItem('introLocalChoices');
    localStorage.removeItem('introUserHasChosen');
    localStorage.removeItem('introChoice');
    localStorage.removeItem('chon_personality_user_choice');
  } catch {
    // ignore
  }
}

const SNAPSHOT_KEY = 'chon_intro_stats_snapshot';

export type IntroStatsSnapshot = {
  yesCount: number;
  noCount: number;
  yesPercentage: number;
  savedAt: number;
};

/** Session is created when the user answers the intro yes/no (before Begin Test). */
export function hasPersonalityUserSession(): boolean {
  if (typeof window === 'undefined') return false;
  const sid = localStorage.getItem('userSessionId');
  return typeof sid === 'string' && sid.trim().length > 0;
}

/** At least one identity card selected (mother / corporate / other / both). */
export function hasPersonalityIdentitySelection(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('chon_personality_identities');
    if (!raw) return false;
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) && arr.length > 0;
  } catch {
    return false;
  }
}

/** Privacy / email verification / questionnaire (except email token handoff — see caller). */
export function canAccessPersonalityVerifyOrQuestionnaire(): boolean {
  return hasPersonalityUserSession() && hasPersonalityIdentitySelection();
}

export function readIntroStatsSnapshot(): IntroStatsSnapshot | null {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  const parsed = safeParse<IntroStatsSnapshot | null>(raw, null);
  if (!parsed || typeof parsed.savedAt !== 'number') return null;
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - parsed.savedAt > maxAgeMs) {
    localStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }
  return parsed;
}

export function writeIntroStatsSnapshot(snapshot: Omit<IntroStatsSnapshot, 'savedAt'>): void {
  try {
    const payload: IntroStatsSnapshot = { ...snapshot, savedAt: Date.now() };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}
