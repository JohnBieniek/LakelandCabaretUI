CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  desiredDate TEXT NOT NULL,
  email TEXT NOT NULL,
  service TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS inquiries_status_updated_idx
  ON inquiries (status, updated_at);

ALTER TABLE inquiries ADD COLUMN message_id TEXT;
ALTER TABLE inquiries ADD COLUMN accepted_at TEXT;
ALTER TABLE inquiries ADD COLUMN delivered_at TEXT;
ALTER TABLE inquiries ADD COLUMN delivery_event TEXT;
ALTER TABLE inquiries ADD COLUMN smtp_status_code TEXT;
ALTER TABLE inquiries ADD COLUMN smtp_response TEXT;

CREATE INDEX IF NOT EXISTS inquiries_message_id_idx
  ON inquiries (message_id);
