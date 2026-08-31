# Identity recovery

- Trigger: password reset, invitation enrollment, verification challenge, session completion, or federation callback fails or is suspected compromised.
- Impact: the affected member cannot safely establish a session; no scope or membership is inferred from browser input.
- Owner: Identity on-call, with Security for compromise and Member owner for membership state.
- Stop loss: revoke the affected session family, expire outstanding single-use tickets and challenges, and rate-limit the actor, device, address, and destination dimensions.
- Diagnosis: correlate request, challenge, ticket, identity, membership, device, and audit identifiers without exposing credential material or plaintext personal data.
- Recovery: issue a fresh server-bound flow, verify the signed return target, complete the challenge once, rotate the session identifier, and re-read authoritative memberships before selection.
- Data repair: append a new credential, link, or membership transition through its owning operation; never edit credential hashes, consumed challenges, tickets, or audit facts in place.
- Validation: the old session and ticket are unusable, the new session has the expected assurance and scope set, access version matches, and cross-scope reads fail closed.
- Escalation: Security immediately for replay, credential stuffing, account takeover, signing-key exposure, or unexplained access-version drift.
- Audit: retain actor, device, target, scope, assurance, reason, rate-limit decision, revocation family, and correlation identifiers while masking personal data.
- Postmortem: record root cause, affected identities and sessions, containment time, recovery evidence, and preventive control owner.
