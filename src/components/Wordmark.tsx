/**
 * The mark: three confidence bars with the middle one low and in the accent
 * colour. It is the product in miniature (a newcomer hesitated at step two).
 * Lives outside the SDK-importing files so the static landing can use it.
 */
export function Wordmark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="1" y="2" width="3" height="12" rx="0.75" className="fill-foreground" />
      <rect x="6.5" y="9" width="3" height="5" rx="0.75" className="fill-primary" />
      <rect x="12" y="5" width="3" height="9" rx="0.75" className="fill-foreground" />
    </svg>
  )
}
