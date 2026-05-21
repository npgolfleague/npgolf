-- Add message_id column to emails table for deduplication in IMAP poller

ALTER TABLE emails
  ADD COLUMN message_id VARCHAR(255) DEFAULT NULL COMMENT 'IMAP/SMTP Message-ID header for deduplication',
  ADD INDEX idx_message_id (message_id);
