# Security Spec

## Data Invariants
- Users can be updated only by themselves (for their names, but not their roles).
- `Order` can be created by any authenticated user for now (or admin, but let's allow any verified user to act as admin/picker).
- `OrderBlock` status can be updated.
- Photos are arrays of strings (max 5).

## Dirty Dozen Payloads
- TBD

## Test Runner
- TBD
