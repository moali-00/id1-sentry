import { cn } from '@/utils/cn'
import { confidenceLabel } from '@/utils/format'

const MAX_SCORE = 5
const SEGMENTS = Array.from({ length: MAX_SCORE }, (_, index) => index)

interface ConfidenceMeterProps {
  /** 0–5. */
  score: number
  className?: string
}

/** Five-segment bar showing how well-corroborated an item is. */
export function ConfidenceMeter({ score, className }: ConfidenceMeterProps) {
  return (
    <span
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={MAX_SCORE}
      aria-label={`Confidence: ${confidenceLabel(score)}`}
      className={cn('inline-flex items-center gap-[2px]', className)}
    >
      {SEGMENTS.map((index) => (
        <i
          key={index}
          className={cn('block h-1.5 w-[9px] rounded-[1px]', index < score ? 'bg-meter' : 'bg-meter-off')}
        />
      ))}
    </span>
  )
}
