ALTER TABLE payments ADD COLUMN covered_purchase_ids TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS payments_covered_purchase_ids_idx ON payments(covered_purchase_ids);
