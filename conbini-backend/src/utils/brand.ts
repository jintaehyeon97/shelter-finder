const BRAND_PATTERNS: Array<{ brand: string; keywords: string[] }> = [
  { brand: 'GS25', keywords: ['지에스25', 'GS25'] },
  { brand: 'CU', keywords: ['씨유', 'CU'] },
  { brand: '세븐일레븐', keywords: ['세븐일레븐', '세븐'] },
  { brand: '이마트24', keywords: ['이마트24'] },
  { brand: '미니스톱', keywords: ['미니스톱'] },
];

export function extractBrand(name: string): string {
  for (const { brand, keywords } of BRAND_PATTERNS) {
    if (keywords.some((kw) => name.includes(kw))) {
      return brand;
    }
  }
  return '기타';
}
