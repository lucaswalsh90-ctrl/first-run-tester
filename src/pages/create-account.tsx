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
  { id: 'google', name: 'Google', hint: 'Gmail or any Google account', hover: 'hover:border-[#4285F4]' },
  {
    id: 'microsoft',
    name: 'Microsoft',
    hint: 'Outlook, Hotmail, work or school',
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
          Use an account you already have. No new password.
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
          <h2 className="text-lg font-semibold text-foreground">Using a different email?</h2>
          <p className="mt-1 text-muted-foreground">
            DeepSpace, which runs this app, has no email-and-password sign-up. Google and Microsoft both let you
            make an account with any address.
          </p>
        </section>

        <p className="mt-8 text-muted-foreground">
          Already have an account? The same buttons sign you in. Only you can see your apps and reports.
        </p>
      </main>
    </>
  )
}
