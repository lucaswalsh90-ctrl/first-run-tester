/**
 * The picture next to an app's name on "Your apps": the app's own icon when it
 * has one, and a coloured letter when it does not. See lib/site-mark.ts.
 */
import { useState } from 'react'
import { fallbackMark, iconCandidates } from '@/lib/site-mark'

export function SiteMark({ name, url, size = 36 }: { name: string; url: string; size?: number }) {
  const candidates = iconCandidates(url)
  // Which candidate is being tried. Each one that fails to load moves on to the next.
  const [at, setAt] = useState(0)
  const next = () => setAt((n) => n + 1)

  if (at < candidates.length) {
    return (
      <img
        src={candidates[at]}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={next}
        // Some servers answer a missing icon with an empty picture.
        onLoad={(e) => e.currentTarget.naturalWidth < 2 && next()}
        className="shrink-0 rounded-md object-contain"
        style={{ width: size, height: size }}
      />
    )
  }

  const { letter, hue } = fallbackMark(name)
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: `hsl(${hue} 55% 90%)`, color: `hsl(${hue} 60% 28%)` }}
    >
      {letter}
    </span>
  )
}
