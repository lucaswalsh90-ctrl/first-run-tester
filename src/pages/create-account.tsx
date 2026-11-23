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
import { ChevronRight } from 'lucide-react'
import { ProviderMark, type Provider } from '../components/ProviderMark'
import { Seo } from '../components/Seo'
import { TopBar } from '../components/TopBar'
import { rememberSignInStarted } from '../lib/prefill'
import { seo } from '../seo'

/** The platform's sign-in route. It sends the person to the provider and brings them back signed in. */
export const signInHref = (provider: string) => `/api/auth/social-redirect?provider=${provider}`

/** Each button picks up its company's own colour when you point at it. */
export const PROVIDERS: Array<{ id: Provider; name: string; hint: string; hover: string }> = [
  { id: 'google', name: 'Google', hint: 'Gmail, or any Google account', hover: 'hover:border-[#4285F4]' },
  {
    id: 'microsoft',
    name: 'Microsoft',
    hint: 'Outlook, Hotmail, Live, or a work or school account',
    hover: 'hover:border-[#00A4EF]',
  },
  { id: 'github', name: 'GitHub', hint: 'The account you push code with', hover: 'hover:border-[#1c1917]' },
]

/** A note set off by a rule down its left side, the way a proofreader marks a margin. */
const NOTE = 'border-l-2 border-primary pl-4'

export default function CreateAccountPage() {
  return (
    <>
      <Seo {...seo} title="Create your account | First-run tester" path="/create-account" />
      <TopBar />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Create your <span className="marker">free</span> account
        </h1>
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
                className={`group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors ${p.hover}`}
              >
                <span className="flex w-9 shrink-0 justify-center">
                  <ProviderMark provider={p.id} size={28} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold text-foreground">Continue with {p.name}</span>
                  <span className="block text-muted-foreground">{p.hint}</span>
                </span>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </a>
            </li>
          ))}
        </ul>

        <section className={`${NOTE} mt-10`}>
          <h2 className="text-lg font-semibold text-foreground">Using a different email address?</h2>
          <p className="mt-1 text-muted-foreground">
            DeepSpace, the platform this app runs on, has switched off sign-up by email and password. Google and
            Microsoft both let you make a free account with any email address, and that account works here.
          </p>
        </section>

        <section className={`${NOTE} mt-6`}>
          <h2 className="text-lg font-semibold text-foreground">What an account is for</h2>
          <p className="mt-1 text-muted-foreground">
            It keeps your apps and reports, and only you can see them. A test of your own app uses your DeepSpace
            credits, and the cost is shown before you start.
          </p>
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
