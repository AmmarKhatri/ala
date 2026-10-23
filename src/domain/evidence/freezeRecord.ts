export function freezeRecord<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) freezeRecord(entry);
    Object.freeze(value);
  }
  return value;
}
