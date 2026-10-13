# Firebase-to-PostgreSQL migration worksheet

This worksheet intentionally does not guess the live Firestore schema. Before implementing an importer, capture authorized exports and confirm exact collection paths and fields from the live project.

## Minimum mapping to validate

| Firebase data concept | PostgreSQL destination | Required validation |
|---|---|---|
| User profile / approval record | `users` | verified identity, role, status, legacy UID mapping |
| Shop settings | `shops` | one owner mapping, receipt options, text fields |
| Product document | `products` | shop ownership, code uniqueness, Decimal price/stock, unit |
| Bill / invoice document | `invoices` | invoice number uniqueness, timestamp/timezone, totals |
| Bill line items | `invoice_items` | snapshot name, unit, quantity, unit price, line total |

## Safe sequence

1. Export and back up; do not mutate the Firebase source.
2. Count records in source collections and save the counts.
3. Create a staging database, not production.
4. Import in dependency order: users, shops, products, invoices, invoice items.
5. Compare per-shop product counts, stock totals, invoice counts, subtotal/discount/total sums, and random invoice samples.
6. Resolve mismatches and rerun idempotently.
7. Only cut over after the owner accepts the reconciliation report.

Firebase password credentials are not exported as plaintext. Never attempt to reverse hashes. Use a verified password-reset process or controlled re-registration.
