# Offline packet — publisher verification boundary

Verified locally on **2026-09-05**, against starting service revision `2790bc69abcc0a2ff2ed9dd67785cf392572f371`, using this packet's dedicated Docker Compose lab. The candidate's source, fixtures and existing tests were not repaired by the publisher.

| Check | Observed result |
|---|---|
| Compose configuration | Valid; internal network; no published host ports; runtime pull policy `never` |
| Image preparation | Existing Dockerfile built successfully while online; dependencies included |
| Base suite `npm test` | 9 passed, 0 failed |
| Repair suite `npm run test:repair` | 6 passed, 0 failed |
| Challenge suite `npm run test:challenge` | 13 passed, 0 failed |
| Typecheck / production build inside isolated lab | Both exit 0 |
| Additional private pending-payment and mixed-refund probes | Both pass on the latest service; both fail on the preceding service with business assertion failures, not environment/import errors |
| Host-edit loop | A new host-side test was discovered and executed inside the running lab without a rebuild; verifier test then removed |
| Submitted SQL execution | Runs against the real disposable Postgres database; execution success is not a verdict that every reported business statement is correct |
| SQL failure propagation | Deliberately invalid table query returns nonzero with `ON_ERROR_STOP=1` |
| Runtime outbound probe | Direct connection to a public IP rejected with `ENETUNREACH` from the lab container |
| Cold restart | Removed/recreated the lab containers/network with `--pull never --no-build`; reset, repair suite and SQL identity check passed again |
| Private verification materials | Kept outside the public packet; no solution tests, answer keys or private hiring observations published |

## What this proves—and does not

This is evidence that the **prepared local CLI/SQL lab and the stated follow-up workflow run**. The 28 passing existing tests are the three named backend/platform suites, not an all-assignment pass. Browser/Flutter suites were not rerun for this CLI-only follow-up. No candidate performance or unaided understanding has been observed by the publisher in this round.

The Docker network was isolated; the publisher did **not** switch off the host Mac's Internet or inspect/disable a candidate's AI tools. A tested internal network does not prove host-wide isolation. The supervisor must repeat preparation and post-disconnection checks on the **actual assessment machine** and supervise the session. If images/dependencies are absent, the machine is not ready for an offline round.

The two latest service repairs have independent narrow execution proof. The round still asks the candidate to explain them, author fresh missing-case tests, prove test sensitivity, correct a remaining business diagnostic, and give an honest handover. Passing tests must not be converted into an automatic hiring decision.
