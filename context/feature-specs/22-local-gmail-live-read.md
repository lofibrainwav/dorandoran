# 22 — Local Gmail Live Read

Goal: prove authorized Gmail READ without leaking message contents.

Rules:
- Reuse isolated Google source token records; never infer Gmail authority from Calendar authority.
- Token record must explicitly include Gmail read-only service/scope before an API call.
- Gmail messages normalize only into PrivateGmailEnvelope on the server/local boundary.
- Smoke output is counts/status only; no subject, sender, snippet, or body.
- Query/window must be bounded and caller-provided; no full-mailbox crawl.
- Invalid/missing credentials fail closed.
- No send, modify, label, draft, or delete capability is introduced.
