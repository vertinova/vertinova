// Language choice for the Swarna Bhumi page: ?lang= / saved choice > visitor country (geo-IP) > browser language > English.
export const LANGS = ['en', 'id', 'zh', 'ar', 'es', 'fr', 'de', 'ja'] as const;
export type Lang = (typeof LANGS)[number];

const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

const COUNTRY_GROUPS: [Lang, string][] = [
  ['id', 'ID MY BN'],
  ['zh', 'CN TW HK MO'],
  ['ja', 'JP'],
  ['de', 'DE AT CH LI'],
  ['fr', 'FR BE LU MC SN CI CM ML BF NE TG BJ GA CG CD MG HT'],
  ['es', 'ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR'],
  ['ar', 'AE SA QA KW BH OM YE IQ JO LB SY PS EG LY TN DZ MA SD MR'],
];
const BY_COUNTRY: Record<string, Lang> = Object.fromEntries(COUNTRY_GROUPS.flatMap(([l, cs]) => cs.split(' ').map((c) => [c, l])));

export const langForCountry = (country: string): Lang => BY_COUNTRY[country.toUpperCase()] ?? 'en';

export function langFromBrowser(langs: readonly string[]): Lang {
  for (const tag of langs) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'ms') return 'id'; // Malay reads Indonesian fine
    if (isLang(base)) return base;
  }
  return 'en';
}

const KEY = 'swarna-lang';

/** Instant guess for the first render: URL param, then saved manual choice, then browser language. */
export function initialLang(): { lang: Lang; fixed: boolean } {
  const param = new URLSearchParams(window.location.search).get('lang');
  if (isLang(param)) return { lang: param, fixed: true };
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return { lang: saved, fixed: true };
  } catch {
    /* storage blocked: fall through */
  }
  return { lang: langFromBrowser(navigator.languages ?? [navigator.language]), fixed: false };
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage blocked: choice lasts this visit only */
  }
}

/** Visitor country via a free geo-IP lookup; null when offline, blocked, or slow. */
export async function countryLang(): Promise<Lang | null> {
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/country.json', { signal: AbortSignal.timeout(2500) });
    const { country } = (await res.json()) as { country?: string };
    return country ? langForCountry(country) : null;
  } catch {
    return null;
  }
}
