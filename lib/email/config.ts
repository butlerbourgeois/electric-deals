/**
 * Email configuration.
 *
 * Required env vars:
 *   RESEND_API_KEY      — get from https://resend.com/api-keys
 *                         Add to .env.local for local dev (never commit)
 *   NEXT_PUBLIC_APP_URL — base URL of the app (e.g. https://electric-deals.com)
 *                         Defaults to 'https://electric-deals.com' in production.
 *                         Set to http://localhost:3000 in .env.local for local dev.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Add it to .env.local for local development, or to your deployment env vars for production.`
    )
  }
  return value
}

// Validated at call-time (not module load) so build doesn't fail when env is absent.
// Callers (resend.ts lazy singleton, orchestrator) invoke this only at runtime.
export function getResendApiKey(): string {
  return requireEnv('RESEND_API_KEY')
}

export const fromAddress = 'Electric Deals <alerts@electric-deals.com>'

export const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://electric-deals.com'
