/**
 * The bar across the top of the public pages (landing and sample report).
 *
 * Added after the first click-through: the only way back from the sample was
 * the logo, which a new user would not think to press. The same three places
 * are now named on every page, and the app's own bar (Navigation.tsx) shows
 * the same tabs once you are inside.
 *
 * It imports nothing from the DeepSpace SDK, so the public pages stay static.
 */
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../lib/utils'
import { Wordmark } from './Wordmark'

export const TABS = [
  { path: '/home', label: 'Your apps' },
  { path: '/sample', label: 'Sample report' },
]

/** One tab. Shared with the signed-in bar so both look the same. */
export function tabClass(active: boolean) {
  return cn(
    'rounded-md px-3 py-1.5 text-base font-medium transition-colors',
    active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
}

export function TopBar() {
  const { pathname } = useLocation()
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Wordmark />
          First-run tester
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.path)
            return (
              <Link key={tab.path} to={tab.path} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                {tab.label}
              </Link>
            )
          })}
        </nav>
        {/* This bar can't tell whether you are signed in (it loads nothing), so the link is always here. */}
        <Link
          to="/create-account"
          aria-current={pathname.startsWith('/create-account') ? 'page' : undefined}
          className={cn(tabClass(pathname.startsWith('/create-account')), 'ml-auto')}
        >
          Create account
        </Link>
      </div>
    </header>
  )
}
