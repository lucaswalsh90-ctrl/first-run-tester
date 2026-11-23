/**
 * Gated routes. Any file under src/pages/(app)/(protected)/ requires sign-in.
 * The `(protected)` folder is a Generouted route group — parentheses mean
 * it doesn't appear in the URL. For a dynamic page that does NOT require
 * sign-in, put it directly under src/pages/(app)/; for a static page, put it
 * at the top level of src/pages/.
 *
 * Children may call data hooks like `useUser()` safely because the parent
 * (app)/_layout.tsx mounts <RecordProvider> above this layout.
 *
 * The `fallback` keeps signed-out visitors inside the app's own chrome
 * (without it, AuthGate shows the SDK's full-screen, non-dismissible
 * overlay). The sign-in overlay opens on demand and can be dismissed.
 */

import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AuthGate, AuthOverlay } from 'deepspace'
import { Button } from '@/components/ui'
import { SIGN_IN_COPY } from '@/constants'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<SignedOutPanel />}>
      <Outlet />
    </AuthGate>
  )
}

function SignedOutPanel() {
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <h1 className="text-lg font-semibold text-foreground">Sign in to test your own app</h1>
        <p className="mt-2 text-sm text-muted-foreground">Three steps, about two minutes:</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-foreground">
          <li>Sign in with Google or GitHub. If you're new, either one creates your free account. For Microsoft or Outlook, use the Create account page.</li>
          <li>Paste your app's public link and say what a newcomer should be able to do.</li>
          <li>Watch an AI newcomer click through it, then get your fix list.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Tests are paid from your own DeepSpace credits (a free account includes 500 a month), which is why
          you need to sign in first.
        </p>
        <Button className="mt-6 w-full" onClick={() => setShowAuthModal(true)}>
          Sign in to start
        </Button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Link
            to="/sample"
            className="text-sm text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Not ready? See a sample report, no sign-in needed
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to the start page
          </Link>
        </div>
      </div>

      {showAuthModal && <AuthOverlay {...SIGN_IN_COPY} onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}
