// PSA auth helper: prefers OAuth2 password grant (PSA_EMAIL/PSA_PASSWORD),
// falls back to a static PSA_API_TOKEN. Never logs credential or token values.
//
// The token exchange shells out to curl: PSA sits behind Cloudflare rules that
// challenge Node's TLS fingerprint on POST /token, while curl passes. The
// credentials are fed via a curl config on stdin so they never appear in argv.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnvLocal() {
  if (existsSync(join(root, '.env.local'))) {
    for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Returns a bearer token string, or throws with a safe (credential-free) message. */
export function getPsaToken() {
  loadEnvLocal();
  const { PSA_EMAIL, PSA_USERNAME, PSA_PASSWORD, PSA_API_TOKEN } = process.env;
  const login = PSA_USERNAME || PSA_EMAIL; // PSA accepts either; username wins if both set

  if (login && PSA_PASSWORD) {
    const config = [
      'url = "https://api.psacard.com/publicapi/token"',
      'request = "POST"',
      `user-agent = "${UA}"`,
      'header = "Content-Type: application/x-www-form-urlencoded"',
      'data-urlencode = "grant_type=password"',
      `data-urlencode = "username=${login}"`,
      `data-urlencode = "password=${PSA_PASSWORD}"`,
      'silent',
    ].join('\n');
    const out = execFileSync('curl', ['--config', '-'], { input: config, encoding: 'utf8' });
    let parsed;
    try {
      parsed = JSON.parse(out);
    } catch {
      throw new Error(`token endpoint returned non-JSON (${out.length} chars) — possibly a Cloudflare challenge`);
    }
    if (parsed.access_token) {
      console.log(`OAuth token acquired (${parsed.token_type ?? 'bearer'}, expires_in=${parsed.expires_in ?? '?'}s)`);
      return parsed.access_token;
    }
    throw new Error(`OAuth grant failed: ${parsed.error ?? 'unknown'} — ${parsed.error_description ?? ''}`);
  }

  if (PSA_API_TOKEN) return PSA_API_TOKEN;
  throw new Error('No PSA credentials: set PSA_EMAIL + PSA_PASSWORD (OAuth) or PSA_API_TOKEN in .env.local');
}
