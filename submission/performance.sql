-- Reproducible query-plan/index experiment for submission/DATABASE.md.
-- Run after `database/performance.sql` has built and populated query_lab_orders
-- in the guarded lab schema (this file only adds the index and re-measures).
SET search_path TO assessment_lab;

-- BEFORE (see submission/perf-before.json): Seq Scan over all 50,000 rows, filtering
-- out 45,000 non-matching rows, followed by a top-N heapsort for ORDER BY ... LIMIT 50.
-- Shared buffer hits: 409. Execution time: 3.655 ms (this run; not an absolute target).

-- Composite index matching the query's equality filter columns (tenant, status) followed
-- by the exact ORDER BY column order and direction (created_at DESC, id DESC), so the
-- index itself is already sorted for this query and no separate Sort node is needed.
CREATE INDEX query_lab_orders_tenant_status_created_id_idx
  ON query_lab_orders (tenant, status, created_at DESC, id DESC);
ANALYZE query_lab_orders;

-- AFTER (see submission/perf-after.json): Index Scan on the new index, Index Cond
-- (tenant='north' AND status='paid'), no Sort node. Shared buffer hits: 8 (5 hit + 3 read).
-- Execution time: 0.079 ms (this run). Result set verified byte-identical to the
-- pre-index run (submission/perf-ids-before.txt vs submission/perf-ids-after.txt, diffed).
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id,amount_paise,created_at FROM query_lab_orders
WHERE tenant='north' AND status='paid'
ORDER BY created_at DESC,id DESC LIMIT 50;

-- Write cost / trade-off note: this index adds one B-tree entry per row on every INSERT/UPDATE
-- that touches (tenant,status,created_at,id) on query_lab_orders — for the real orders table,
-- the equivalent index should be validated against actual write volume before adding it, since
-- the assessment fixture's orders table is only 8 rows and would not benefit from it at all
-- (a full-table scan of 8 rows is already faster than an index lookup); this index is justified
-- specifically for query_lab_orders' 50,000-row scale, not proposed for the small business tables.
