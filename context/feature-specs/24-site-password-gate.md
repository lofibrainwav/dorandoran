# Unit 24 — DoranDoran Site Password Gate

## Security boundary
- `dorandoran.link` pages require an explicit site password before content is rendered.
- The password and cookie-signing secret live only in environment variables; neither is committed to git.
- The browser receives only an HttpOnly, Secure, SameSite=Lax authorization cookie.
- The cookie value is a SHA-256 token derived from password + independent gate secret; the raw password never enters the cookie.
- `/unlock` and the unlock endpoint remain reachable without authorization; app content and `/family` remain gated.
- Static Next assets may load before authorization but must contain no private Family source data.
- The unlock page is `noindex,nofollow`.
