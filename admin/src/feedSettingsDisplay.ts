export type FilterDefinition = {
  key: string;
  label: string;
  control: 'segmented' | 'range' | 'number' | 'multi';
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  sortOrder: number;
};

export type AdminPersonFeedSettings = {
  filters: Record<string, unknown>;
  filters_updated_at: string | null;
  shared_interests: string;
  specific_interests: string[];
  relationship_goals: string;
  distance: string;
};

const RANKING_LABELS: Record<'shared_interests' | 'relationship_goals' | 'distance', string> = {
  shared_interests: 'Shared Interests',
  relationship_goals: 'Relationship Goals',
  distance: 'Distance',
};

function formatRangeValue(d: FilterDefinition, n: number): string {
  const top = d.maxValue != null && n >= d.maxValue;
  if (d.unit === 'in') return `${Math.floor(n / 12)}'${n % 12}"${top ? '+' : ''}`;
  if (d.unit === 'years') return `${n}${top ? '+' : ''}`;
  return `${n}${top ? '+' : ''}`;
}

function formatFilterValue(d: FilterDefinition, filters: Record<string, unknown>): string {
  const raw = filters[d.key];
  if (raw == null || raw === '') return 'Any';

  if (d.control === 'segmented' || d.control === 'number') {
    return String(raw);
  }

  if (d.control === 'multi') {
    const arr = Array.isArray(raw) ? raw : [String(raw)];
    return arr.length ? arr.join(', ') : 'Any';
  }

  if (d.control === 'range' && d.minValue != null && d.maxValue != null) {
    const saved = raw as { min?: number; max?: number };
    const lo0 = d.minValue;
    const hi0 = d.maxValue;
    const low = Math.min(Math.max(saved.min ?? lo0, lo0), hi0);
    const high = Math.min(Math.max(saved.max ?? hi0, lo0), hi0);
    if (low <= lo0 && high >= hi0) return 'Any';
    return `${formatRangeValue(d, low)} – ${formatRangeValue(d, high)}`;
  }

  return String(raw);
}

function formatWeight(value: string): string {
  if (!value) return 'Medium';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function mapFilterDefinition(row: Record<string, unknown>): FilterDefinition {
  return {
    key: String(row.key),
    label: String(row.label),
    control: String(row.control) as FilterDefinition['control'],
    minValue: row.min_value == null ? null : Number(row.min_value),
    maxValue: row.max_value == null ? null : Number(row.max_value),
    unit: row.unit ? String(row.unit) : null,
    sortOrder: Number(row.sort_order) || 0,
  };
}

export function describeFilterLines(
  defs: FilterDefinition[],
  filters: Record<string, unknown>,
): { label: string; value: string }[] {
  return defs.map((d) => ({ label: d.label, value: formatFilterValue(d, filters) }));
}

export function describeRankingLines(settings: AdminPersonFeedSettings): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [
    {
      label: RANKING_LABELS.shared_interests,
      value:
        settings.shared_interests === 'specific'
          ? `Specific (${settings.specific_interests.length} selected)`
          : formatWeight(settings.shared_interests),
    },
    { label: RANKING_LABELS.relationship_goals, value: formatWeight(settings.relationship_goals) },
    { label: RANKING_LABELS.distance, value: formatWeight(settings.distance) },
  ];
  return lines;
}

export function specificInterestsSummary(settings: AdminPersonFeedSettings): string | null {
  if (settings.shared_interests !== 'specific' || settings.specific_interests.length === 0) return null;
  return settings.specific_interests.join(', ');
}
