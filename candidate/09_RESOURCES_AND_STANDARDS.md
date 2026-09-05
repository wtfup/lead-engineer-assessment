# Documentation and engineering standards

These are official learning references, not a demand to memorise APIs. Read the exact version relevant to your implementation. The exercise API is synthetic and must not be described as an actual Meta/payment-provider integration.

## Primary technologies

- PostgreSQL 16 transactions: https://www.postgresql.org/docs/16/tutorial-transactions.html
- PostgreSQL 16 transaction isolation: https://www.postgresql.org/docs/16/transaction-iso.html
- PostgreSQL 16 constraints: https://www.postgresql.org/docs/16/ddl-constraints.html
- PostgreSQL 16 EXPLAIN: https://www.postgresql.org/docs/16/using-explain.html
- PostgreSQL 16 multicolumn indexes: https://www.postgresql.org/docs/16/indexes-multicolumn.html
- node-postgres transaction ownership: https://node-postgres.com/features/transactions
- Node test runner: https://nodejs.org/api/test.html
- React effects and asynchronous cleanup: https://react.dev/reference/react/useEffect
- Next data fetching: https://nextjs.org/docs/app/getting-started/fetching-data
- TypeScript handbook: https://www.typescriptlang.org/docs/handbook/intro.html
- Playwright test assertions: https://playwright.dev/docs/test-assertions

## Secondary and learning

- Flutter networking: https://docs.flutter.dev/cookbook/networking/fetch-data
- Flutter widget testing: https://docs.flutter.dev/cookbook/testing/widget/introduction
- Dart asynchronous programming: https://dart.dev/libraries/async/async-await
- n8n error handling: https://docs.n8n.io/flow-logic/error-handling/
- Meta Conversions API: https://developers.facebook.com/docs/marketing-api/conversions-api/
- OWASP API security: https://owasp.org/API-Security/

## Standards demonstrated through work

Explain trust boundaries, deterministic policy, input validation, parameterised queries, money/time semantics, state invariants, transaction ownership, retries, idempotency, error taxonomy, authorization versus filtering, secrets/PII logging, migration compatibility and rollback limits. Cite evidence from your implementation. Naming a standard without applying it earns little credit. Do not add a library or service merely because it appears on this list.
