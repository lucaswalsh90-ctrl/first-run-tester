/**
 * Optional test login for apps whose pages sit behind sign-in.
 * What is typed here stays in the tab's memory (see src/lib/test-login.ts).
 */
import { Input, Label } from '@/components/ui'
import { setTestLogin, useTestLogin } from '@/lib/test-login'

export function TestLoginBox({ siteId, open = false }: { siteId: string; open?: boolean }) {
  const login = useTestLogin(siteId)
  const filled = !!login.email.trim() && !!login.password
  const half = !filled && (!!login.email || !!login.password)

  return (
    <details className="mt-3 rounded-md border border-border p-3" open={open || undefined}>
      <summary className="cursor-pointer text-sm text-foreground">
        Test login (optional){filled ? ': ready for the next run' : ''}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        If your app needs sign-in, give the AI newcomer a throwaway test account that signs in with an email and a
        password. It can't use Google or GitHub sign-in. On a DeepSpace app, make one with{' '}
        <code className="rounded bg-muted px-1">npx deepspace test accounts create</code>. Never use a real
        account.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`login-email-${siteId}`}>Test account email</Label>
          <Input
            id={`login-email-${siteId}`}
            type="email"
            autoComplete="off"
            value={login.email}
            onChange={(e) => setTestLogin(siteId, { ...login, email: e.target.value })}
            placeholder="tester@deepspace.test"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`login-password-${siteId}`}>Test account password</Label>
          <Input
            id={`login-password-${siteId}`}
            type="password"
            autoComplete="new-password"
            value={login.password}
            onChange={(e) => setTestLogin(siteId, { ...login, password: e.target.value })}
          />
        </div>
      </div>
      {half && <p className="mt-2 text-xs text-foreground">Fill in both fields, or clear both to test signed out.</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        Kept only in this tab until you reload. It is sent when you start a test, typed by the agent on your app's
        own address, and never saved by this app.
      </p>
    </details>
  )
}
