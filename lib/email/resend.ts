import { Resend } from 'resend'
import { getResendApiKey } from './config'

// Lazy singleton — don't instantiate at module load time.
// Instantiating during the build or in environments without RESEND_API_KEY would throw.
let _client: Resend | null = null

export function getResendClient(): Resend {
  if (!_client) {
    _client = new Resend(getResendApiKey())
  }
  return _client
}
