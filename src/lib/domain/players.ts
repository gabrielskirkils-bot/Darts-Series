// Player names, duplicate warning, search and sort (SPEC section 4.1).

export const NAME_MAX = 60;
export const NICKNAME_MAX = 30;

/** Trims and collapses inner whitespace. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Case-insensitive key matching the DB unique index lower(trim(name)). */
export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

export type PlayerInput = { name: string; nickname: string };

export type PlayerInputError = "nameRequired" | "nameTooLong" | "nicknameTooLong";

/** Normalized values plus validation errors (empty when valid). */
export function validatePlayerInput(input: PlayerInput): {
  value: { name: string; nickname: string | null };
  errors: PlayerInputError[];
} {
  const name = normalizeName(input.name);
  const nickname = normalizeName(input.nickname);
  const errors: PlayerInputError[] = [];
  if (!name) errors.push("nameRequired");
  if (name.length > NAME_MAX) errors.push("nameTooLong");
  if (nickname.length > NICKNAME_MAX) errors.push("nicknameTooLong");
  return { value: { name, nickname: nickname || null }, errors };
}

/** An existing player with the same name (case-insensitive), ignoring `excludeId`. */
export function findDuplicateName<T extends { id: string; name: string }>(
  name: string,
  players: readonly T[],
  excludeId?: string,
): T | null {
  const key = nameKey(name);
  if (!key) return null;
  return players.find((p) => p.id !== excludeId && nameKey(p.name) === key) ?? null;
}

/** Lowercase without diacritics, so "janis" finds "Jānis". */
export function foldText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Players whose name or nickname contains every word of the query. */
export function searchPlayers<T extends { name: string; nickname: string | null }>(
  players: readonly T[],
  query: string,
): T[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...players];
  return players.filter((p) => {
    const text = foldText(`${p.name} ${p.nickname ?? ""}`);
    return words.every((w) => text.includes(w));
  });
}

export type PlayerSortKey = "name" | "elo" | "points" | "tournaments";

export type SortablePlayer = {
  name: string;
  elo: number;
  points: number;
  tournaments: number;
};

/** Name A→Z; numbers high→low with name as the tie-break. */
export function sortPlayers<T extends SortablePlayer>(players: readonly T[], key: PlayerSortKey): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  return [...players].sort((a, b) => (key === "name" ? 0 : b[key] - a[key]) || byName(a, b));
}
