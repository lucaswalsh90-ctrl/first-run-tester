/**
 * Create account: a page that says how to get one.
 *
 * Before this, the only door was a box titled "Sign in". The app's own
 * first-run tests kept reporting that newcomers saw no way to create an
 * account, and the person who built it said the same.
 *
 * What the platform allows, checked against its sign-in service on 23 November 2026:
 * - Google, GitHub and Microsoft accounts all work. The platform's own sign-in
 *   box only shows the first two, so Microsoft (which covers Outlook) had no
 *   button anywhere.
 * - Signing up with only an email and a password is switched off by DeepSpace
 *   ("Public signup disabled"), so this page can't offer it and says so.
 *
 * Each button is a plain link to the platform's own sign-in route. Nothing
 * about accounts or passwords is handled by this app's code.
 *
 * This is a STATIC page (top level of src/pages/), prerendered at build.
 */
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { TopBar } from '../components/TopBar'
import { rememberSignInStarted } from '../lib/prefill'
import { seo } from '../seo'

/** The platform's sign-in route. It sends the person to the provider and brings them back signed in. */
export const signInHref = (provider: string) => `/api/auth/social-redirect?provider=${provider}`

export const PROVIDERS = [
  { id: 'google', name: 'Google', hint: 'Gmail, or any Google account' },
  { id: 'microsoft', name: 'Microsoft', hint: 'Outlook, Hotmail, Live, or a work or school account' },
  { id: 'github', name: 'GitHub', hint: 'The account you push code with' },
]

const CARD = 'rounded-lg border border-border bg-card p-5'

export default function CreateAccountPage() {
  return (
    <>
      <Seo {...seo} title="Create your account | First-run tester" path="/create-account" />
      <TopBar />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Create your free account</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Use an account you already have. There is no new password to set, and the same button signs you back in
          next time.
        </p>

        <ul className="mt-6 space-y-3">
          {PROVIDERS.map((p) => (
            <li key={p.id}>
              <a
                href={signInHref(p.id)}
                onClick={rememberSignInStarted}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:bg-muted"
              >
                <span>
                  <span className="block text-lg font-semibold text-foreground">Continue with {p.name}</span>
                  <span className="block text-muted-foreground">{p.hint}</span>
                </span>
                <span aria-hidden className="text-xl text-muted-foreground">→</span>
              </a>
            </li>
          ))}
        </ul>

        <section className={`${CARD} mt-8`}>
          <h2 className="text-lg font-semibold text-foreground">Using a different email address?</h2>
          <p className="mt-2 text-muted-foreground">
            Signing up with only an email and a password is switched off by DeepSpace, the platform this app runs
            on, so it can't be offered here. Google and Microsoft both let you make a free account with any email
            address you already use, and that account then works on this page.
          </p>
        </section>

        <section className={`${CARD} mt-4`}>
          <h2 className="text-lg font-semibold text-foreground">What an account is for</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Your apps and reports are saved to it, and only you can see them.</li>
            <li>The sample report stays free. A test of your own app uses your DeepSpace credits, and the cost is shown before you start.</li>
          </ul>
        </section>

        <p className="mt-8 text-muted-foreground">
          Already have an account? Any button above signs you in. A test account made with an email and a password
          signs in from{' '}
          <Link to="/home" className="font-medium text-foreground underline underline-offset-4">
            Your apps
          </Link>
          .
        </p>
      </main>
    </>
  )
}
