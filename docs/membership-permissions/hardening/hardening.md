# Security Hardening Review: Membership Organization Scopes

## Evidence Basis

We inspected the shared authorization contract, pure decision engine, membership schema, command-center mutation path and server-side resource-scope loader at revision `2b39175`. The evidence shows a safe tenant boundary, but organization inheritance was encoded through a growing set of flat IDs. Role membership changes invalidated sessions, while edits to a role's permission set did not propagate to every affected membership.

## Constraints

- Existing tenant, enterprise, mall and department columns must remain available.
- Browser input must never define a resource's ancestors.
- Non-global grants must remain unable to cross the security tenant boundary.
- The change must be incrementally deployable and reversible.
- Supplier, brand and store relationships are not a strict organization tree.

## Opportunity Portfolio

| Opportunity                               | Evidence                                               | Options                                                                    | Recommendation          | Proposal                                                           |
| ----------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------ |
| Centralize hierarchical scope containment | Flat scope contract and exact-match engine (E001–E005) | Local flat-field expansion; compatibility hierarchy; immediate replacement | Compatibility hierarchy | [Complete proposal](./proposals/hierarchical-scope-containment.md) |

## Recommendation Summary

I recommend the compatibility hierarchy: add an organization node and closure layer, keep current business columns, and let the server attach a database-derived ancestor path to resource facts. This removes the need to add another flat field for every organizational level while preserving the current rollback path. Global platform and future distributor grants remain unavailable from the tenant command center.

## Next Decisions

- Define the dedicated global grant and Owner-transfer ceremony.
- Decide when a distributor becomes a real managed entity.
- Design commercial relationship tables separately from the organization tree.
- Implement employee visibility and purchasing entitlements as a separate policy system.
