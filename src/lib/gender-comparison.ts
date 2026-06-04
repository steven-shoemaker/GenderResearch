/** Split of gendered-word share: bar is 100% masculine + feminine matches only. */
export function genderedWordSplit(
  masculinePercent: number,
  femininePercent: number,
): { mascShare: number; femShare: number; hasGendered: boolean } {
  const masc = Math.max(0, masculinePercent);
  const fem = Math.max(0, femininePercent);
  const gendered = masc + fem;
  if (gendered <= 0) {
    return { mascShare: 0, femShare: 0, hasGendered: false };
  }
  const mascShare = (masc / gendered) * 100;
  return {
    mascShare,
    femShare: 100 - mascShare,
    hasGendered: true,
  };
}
