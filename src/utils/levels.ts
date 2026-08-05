import type { AssessmentLevel } from '@/types/sentiry'

/**
 * Assessment level → colour.
 *
 * Fixed hues, like the threat categories: a level must read identically in
 * light and dark so an operator switching themes never re-learns it. Shared by
 * the target card, the rail row and the dossier so the three cannot disagree.
 *
 * The five levels fold onto the design system's four risk steps (mirrored as
 * `--color-risk-*` in `index.css`, which is where these values are documented).
 * `guarded` takes risk-medium's grey rather than doubling up on green: it is the
 * level that means *nothing is wrong and we are still watching*, which is a
 * neutral reading, not a reassuring one. Only the top two share a hue, and they
 * share it because red is where the ramp has to end.
 */
export const LEVEL_COLOR: Record<AssessmentLevel, string> = {
  low: '#05df72', // risk-low
  guarded: '#90a1b9', // risk-medium
  elevated: '#fbbf24', // risk-high
  high: '#ff6467', // risk-critical
  severe: '#ff6467', // risk-critical
}

export const levelColor = (level: AssessmentLevel | null | undefined): string =>
  level ? (LEVEL_COLOR[level] ?? LEVEL_COLOR.elevated) : LEVEL_COLOR.elevated
