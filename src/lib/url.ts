/**
 * Can the browser agent reach this link from the internet?
 *
 * The agent runs in Apify's cloud, so a link to your own machine or home
 * network can't work, and starting a test on one would spend credits for
 * nothing. Used by the Add app form (early, friendly) and by the server
 * actions (the real check).
 */
export function isPublicHttpUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false

  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (host.startsWith('[')) return false // IPv6 literals: not worth guessing which are public
  if (!host.includes('.')) return false // "localhost", "my-laptop"
  if (host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')) return false

  // Only treat it as an IP address when it is all digits and dots,
  // so real sites like 10.times.com are not refused.
  if (/^[\d.]+$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    const privateRange =
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    if (privateRange) return false
  }
  return true
}
