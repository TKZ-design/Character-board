// =====================================================================
//  link-preview — Supabase Edge Function for the Link Vault
//
//  Given { "url": "https://…" } it returns the page's Open Graph preview:
//  { ok, url, title, description, image, site_name }.
//
//  It only works for a logged-in user of YOUR project (it checks the login
//  token itself). The safe-fetching rules (no private/internal addresses,
//  timeouts, size limits) live in ../_shared/preview.ts.
//
//  Deployed automatically by .github/workflows/deploy-functions.yml (see README).
// =====================================================================
import { preview, PreviewError, resolveDns, type FetchDeps } from '../_shared/preview.ts';

export { isPrivateIp, checkUrl, parseMeta, readCapped, safeFetch, absoluteHttpUrl, preview, PreviewError } from '../_shared/preview.ts';

const ALLOWED_ORIGINS = [
  'https://tkz-design.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

type Deps = FetchDeps & {
  getUser: (req: Request) => Promise<{ id: string } | null>;
};

// ---------------- HTTP handler ----------------

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const headers = cors(req);
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Use POST' });

  const user = await deps.getUser(req).catch(() => null);
  if (!user) return reply(401, { ok: false, error: 'Please log in' });

  let url = '';
  try {
    const text = await req.text();
    if (text.length > 8192) return reply(413, { ok: false, error: 'Request too large' });
    url = String(JSON.parse(text)?.url ?? '');
  } catch { return reply(400, { ok: false, error: 'Send JSON like {"url": "https://…"}' }); }
  if (!url || url.length > 2048) return reply(400, { ok: false, error: 'Missing or too long url' });

  try {
    return reply(200, await preview(url, deps));
  } catch (e) {
    const err = e instanceof PreviewError ? e : new PreviewError('Preview failed', 502);
    return reply(err.status, { ok: false, error: err.message });
  }
}


async function getUser(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) return null;
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno.env;
  const base = env.get('SUPABASE_URL');
  const key = env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
  // Asks Supabase Auth who this token belongs to: fails for expired/forged
  // tokens and for the public anon key (which is not a user).
  const r = await fetch(`${base}/auth/v1/user`, { headers: { authorization: auth, apikey: key }, signal: AbortSignal.timeout(4000) });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id } : null;
}

// deno-lint-ignore no-explicit-any
const DenoNs = (globalThis as any).Deno;
// deno-lint-ignore no-explicit-any
if (DenoNs?.serve && !(globalThis as any).__LINK_PREVIEW_TEST__) {
  DenoNs.serve((req: Request) => handle(req, { fetch, resolve: resolveDns, getUser }));
}
