const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s]/gi;
const WHITESPACE_REGEX = /\s+/g;

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, " ")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

export function normalizeWatchTerms(title: string, aliases: string[] = []): string[] {
  return [title, ...aliases]
    .map((value) => normalizeText(value))
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}
