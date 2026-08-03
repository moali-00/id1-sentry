import type { AssessmentLevel } from '@/types/sentiry'

/**
 * Assessment level → colour.
 *
 * Fixed hues, like the threat categories: a level must read identically in
 * light and dark so an operator switching themes never re-learns it. Shared by
 * the target card, the rail row and the dossier so the three cannot disagree.
 */
export const LEVEL_COLOR: Record<AssessmentLevel, string> = {
  low: '#05df72',
  guarded: '#05df72',
  elevated: '#fbbf24',
  high: '#ff6467',
  severe: '#ff6467',
}

export const levelColor = (level: AssessmentLevel | null | undefined): string =>
  level ? (LEVEL_COLOR[level] ?? LEVEL_COLOR.elevated) : LEVEL_COLOR.elevated
