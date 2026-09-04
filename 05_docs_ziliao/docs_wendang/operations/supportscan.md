# Support attachment scan

- Trigger: malware scan fails/times out, file metadata differs, or scan job dead-letters.
- Impact: attachment remains quarantined and is not downloadable.
- Owner: Support on-call with Security owner.
- Stop loss: keep object private/quarantined; do not bypass scan.
- Diagnosis: verify size, MIME, magic bytes, extension, hash, image/archive limits and scanner response.
- Recovery: restore scanner dependency and replay the same evidence ID.
- Data repair: upload a new server-named object when content is corrected; preserve rejected evidence.
- Validation: clean status, unchanged hash, authorized short-lived URL and access audit.
- Escalation: security incident process for malware or suspected exposure.
- Audit: record scanner/version, hash, disposition and actor.
- Postmortem: include sample classification and control action.
