/**
 * Small helpers for the JSON-encoded-string columns Prisma/SQLite uses in
 * place of native JSON columns (see prisma/schema.prisma header comment).
 */

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}
