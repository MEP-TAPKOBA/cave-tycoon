ALTER TABLE players ADD COLUMN paid_until INTEGER NOT NULL DEFAULT 0;
UPDATE players SET paid_until = bless_until;
