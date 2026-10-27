<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All HTTP API lives in src/lib/monit/api.ts, mounted by the single splat route src/routes/api/$.ts — keeps one backend, testable without a server.
- src/lib/monit/supabase.ts is the only Supabase access (raw PostgREST fetch, service key server-side) — browser never touches Supabase; sb_secret_ keys go only as apikey.
- Admin auth is a password env var + HMAC-signed HttpOnly cookie; no Supabase Auth — the spec forbids a parallel auth system.
- supabase/schema.sql is the schema source of truth and must match the migration.
