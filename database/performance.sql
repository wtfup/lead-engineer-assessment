-- Separate, repeatable 50k-row SQL lab. Run after reset in the guarded lab schema.
-- No absolute timing target: record plan shape, estimates, buffers, identical result IDs and trade-offs.
DO $$ BEGIN
  IF current_database()<>'assessment' OR current_user<>'assessment' THEN
    RAISE EXCEPTION 'Lab database only';
  END IF;
  -- Plain psql/pg clients start in public; use the existing reset-created lab,
  -- while preserving isolated test schemas supplied by the test harness.
  IF current_schema()='public' THEN
    PERFORM set_config('search_path','assessment_lab',false);
  END IF;
  IF COALESCE(current_schema(),'') !~ '^assessment_(lab|test_[a-f0-9]{24})$' THEN
    RAISE EXCEPTION 'Lab schema required; run the guarded reset first';
  END IF;
END $$;
DROP TABLE IF EXISTS query_lab_orders;
CREATE TABLE query_lab_orders (
 id bigint PRIMARY KEY, tenant text NOT NULL, status text NOT NULL,
 amount_paise integer NOT NULL, created_at timestamptz NOT NULL
);
INSERT INTO query_lab_orders
SELECT n, CASE WHEN n%2=0 THEN 'north' ELSE 'south' END,
  CASE WHEN n%5=0 THEN 'paid' ELSE 'pending' END,
  10000 + (n%100)*100,
  TIMESTAMPTZ '2026-01-01T00:00:00Z' + n * INTERVAL '1 minute'
FROM generate_series(1,50000) AS g(n);
ANALYZE query_lab_orders;
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id,amount_paise,created_at FROM query_lab_orders
WHERE tenant='north' AND status='paid'
ORDER BY created_at DESC,id DESC LIMIT 50;
