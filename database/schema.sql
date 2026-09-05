CREATE TABLE tenants (id text PRIMARY KEY CHECK (id IN ('north','south')));
CREATE TABLE campaigns (
 id text PRIMARY KEY, tenant text NOT NULL REFERENCES tenants(id), name text NOT NULL,
 UNIQUE (tenant,id)
);
CREATE TABLE orders (
 id text PRIMARY KEY, tenant text NOT NULL REFERENCES tenants(id), campaign_id text,
 amount_paise integer NOT NULL CHECK (amount_paise > 0), currency text NOT NULL CHECK (currency = 'INR'),
 status text NOT NULL CHECK (status IN ('pending','paid','failed')), created_at timestamptz NOT NULL,
 UNIQUE (tenant,id), FOREIGN KEY (tenant,campaign_id) REFERENCES campaigns(tenant,id)
);
CREATE INDEX orders_tenant_id_idx ON orders(tenant,id);
CREATE TABLE refunds (
 id text PRIMARY KEY, tenant text NOT NULL, order_id text NOT NULL,
 amount_paise integer NOT NULL CHECK (amount_paise > 0), status text NOT NULL CHECK (status IN ('settled','pending')),
 occurred_at timestamptz NOT NULL, FOREIGN KEY (tenant,order_id) REFERENCES orders(tenant,id)
);
CREATE TABLE ad_metrics (
 tenant text NOT NULL, campaign_id text NOT NULL, day date NOT NULL,
 spend_paise integer NOT NULL CHECK (spend_paise >= 0), reported_conversions integer NOT NULL,
 reported_revenue_paise integer NOT NULL,
 PRIMARY KEY (tenant,campaign_id,day), FOREIGN KEY (tenant,campaign_id) REFERENCES campaigns(tenant,id)
);
CREATE TABLE payment_events (
 id bigserial PRIMARY KEY, tenant text NOT NULL, event_id text NOT NULL, payment_id text NOT NULL,
 order_id text NOT NULL, status text NOT NULL CHECK (status IN ('succeeded','failed','pending')),
 amount_paise integer NOT NULL CHECK (amount_paise > 0), currency text NOT NULL CHECK (currency='INR'),
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant,event_id), FOREIGN KEY (tenant,order_id) REFERENCES orders(tenant,id)
);
CREATE TABLE payments (
 tenant text NOT NULL, payment_id text NOT NULL, order_id text NOT NULL,
 status text NOT NULL CHECK (status IN ('succeeded','failed','pending')),
 amount_paise integer NOT NULL CHECK (amount_paise>0),
 PRIMARY KEY (tenant,payment_id), FOREIGN KEY (tenant,order_id) REFERENCES orders(tenant,id)
);
CREATE TABLE outbox (
 id bigserial PRIMARY KEY, tenant text NOT NULL, order_id text NOT NULL, business_key text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (tenant,order_id) REFERENCES orders(tenant,id)
);
CREATE TABLE audit (
 id bigserial PRIMARY KEY, tenant text NOT NULL, order_id text NOT NULL,
 event_id text, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant,order_id) REFERENCES orders(tenant,id)
);
-- This deterministic provider is a separate durable boundary, not a network client.
CREATE TABLE provider_receipts (
 business_key text PRIMARY KEY, tenant text NOT NULL, order_id text NOT NULL,
 receipt_id text NOT NULL UNIQUE, accepted_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant,order_id) REFERENCES orders(tenant,id)
);
CREATE TABLE fulfilments (
 id bigserial PRIMARY KEY, job_id bigint NOT NULL UNIQUE REFERENCES outbox(id),
 tenant text NOT NULL, order_id text NOT NULL, receipt_id text NOT NULL,
 FOREIGN KEY (tenant,order_id) REFERENCES orders(tenant,id)
);
