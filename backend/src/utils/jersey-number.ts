export function normalizeJerseyNumber(value: unknown) {
  const jerseyNumber = String(value ?? '').trim();

  if (!/^\d+$/.test(jerseyNumber)) {
    return null;
  }

  return jerseyNumber;
}

export function compareJerseyNumbers(left: string, right: string) {
  const numericDiff = Number(left) - Number(right);

  if (numericDiff !== 0) {
    return numericDiff;
  }

  const lengthDiff = left.length - right.length;

  if (lengthDiff !== 0) {
    return lengthDiff;
  }

  return left.localeCompare(right);
}
