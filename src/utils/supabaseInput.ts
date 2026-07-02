export function emptyToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function optionalUuid(value: string | null | undefined) {
  return emptyToNull(value);
}

export function uniqueUuids(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(emptyToNull).filter((value): value is string => Boolean(value))));
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeEmployeeCode(value: string) {
  return value.trim().toUpperCase();
}
