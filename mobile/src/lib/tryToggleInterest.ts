/** Toggle one interest on 03e; reports when the max pick count blocks an add. */
export function tryToggleInterest(
  list: string[],
  value: string,
  max: number,
): { list: string[]; blockedByLimit: boolean } {
  if (list.includes(value)) {
    return { list: list.filter((v) => v !== value), blockedByLimit: false };
  }
  if (list.length >= max) {
    return { list, blockedByLimit: true };
  }
  return { list: [...list, value], blockedByLimit: false };
}
