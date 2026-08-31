# Identity provider rotation

Owner: Identity and Security. Rotate Provider client secrets, webhook HMAC keys and OIDC JWKS references through Secret Store references only. Provider configuration stores a Secret Ref and version metadata; it never stores or returns secret material.

Use a reviewed dual-key window when the Provider supports it: publish the new Provider-side credential, update the Secret Ref, run the fixed-endpoint provider health test, roll canaries, validate authorization-code/PKCE, State, Nonce, issuer, audience and callback signing, and then revoke the old credential. If the Provider does not support overlap, schedule a controlled login freeze and retain an already authenticated local Session only while its AccessVersion and CredentialVersion remain valid.

JWKS refresh is single-flight and accepts only the configured issuer, audience, algorithms and key identifiers. A refresh or Provider outage must never relax validation or create a Session. Roll back by restoring the last approved Secret Ref and Provider-side state; preserve audit evidence without copying secret values.

Invitation HMAC keys follow the separate bounded KeyRing procedure in [invitationkeyrotation.md](./invitationkeyrotation.md). Session compromise and Session signing-key response follow [sessioncompromise.md](./sessioncompromise.md); do not reuse either procedure as a compatibility fallback for Provider authentication.
