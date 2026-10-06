import { themeOptions, travelModes, type PlannerCriteria, type Theme } from "./platform-data";
import type { TravelMode } from "./travel";

export const plannerDefaults = (): PlannerCriteria => ({
  county: "于都县",
  startDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10),
  days: 2,
  theme1: "长征文化",
  theme2: "群众支前",
  experience: "现场观察",
  purpose: "社会实践",
  travelMode: "self",
});

type SearchInput = Record<string, string | string[] | undefined>;

export function decodeQueryValue(value: string | undefined) {
  if (!value) return value;
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

const first = (value: string | string[] | undefined) =>
  decodeQueryValue(Array.isArray(value) ? value[0] : value);

export function parsePlannerCriteria(input: SearchInput): PlannerCriteria {
  const defaults = plannerDefaults();
  const theme = (value: string | undefined, fallback: Theme) =>
    themeOptions.includes(value as Theme) ? value as Theme : fallback;
  const travelMode = (value: string | undefined, fallback: TravelMode) =>
    travelModes.some(item => item.value === value) ? value as TravelMode : fallback;
  const days = Number(first(input.days));
  return {
    county: first(input.county) || defaults.county,
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(first(input.startDate) || "") ? first(input.startDate)! : defaults.startDate,
    days: Number.isInteger(days) && days >= 1 && days <= 5 ? days : defaults.days,
    theme1: theme(first(input.theme1), defaults.theme1),
    theme2: theme(first(input.theme2), defaults.theme2),
    experience: first(input.experience) || defaults.experience,
    purpose: first(input.purpose) || defaults.purpose,
    travelMode: travelMode(first(input.travelMode), defaults.travelMode),
  };
}

export function plannerQuery(criteria: PlannerCriteria) {
  const values: Record<keyof PlannerCriteria, string> = {
    county: criteria.county,
    startDate: criteria.startDate,
    days: String(criteria.days),
    theme1: criteria.theme1,
    theme2: criteria.theme2,
    experience: criteria.experience,
    purpose: criteria.purpose,
    travelMode: criteria.travelMode,
  };
  return Object.entries(values)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function planHref(planId: string, criteria: PlannerCriteria) {
  return `/routes/${encodeURIComponent(planId)}?${plannerQuery(criteria)}`;
}
