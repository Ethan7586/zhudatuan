# Session compromise

Owner: Identity and Security. Determine the smallest affected Principal, Membership, Target, Scope and signing-key version from immutable Session, Access decision and Audit evidence. Never copy Session tokens, cookies, OTP values or PII into the incident record.

Revoke affected local Sessions first, increment the applicable CredentialVersion or AccessVersion in the same controlled transaction, clear Target-specific cookies and verify canonical authorization rejects the old Session. For broad signing-key exposure, rotate the Session key through Secret Store under an approved emergency change, restart canaries and then all API instances; do not reuse Invitation, Identity, Provider or ReturnTarget key material.

External logout is best effort after local revocation and must not block it. Enterprise WeChat lacking reliable global logout is reported as local Session revocation, not as Provider logout. Validate Console and Storefront isolation, navigation invalidation, Step-Up expiry, active Session counts and rejected old-version requests before closing the incident.
