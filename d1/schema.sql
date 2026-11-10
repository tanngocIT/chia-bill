-- Chia bill nhóm – Cloudflare D1 schema
-- Applied once to the D1 database bound to the Pages project as `DB`.
CREATE TABLE IF NOT EXISTS parties (
  id            TEXT PRIMARY KEY,
  data          TEXT NOT NULL,
  edit_key_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  party_id   TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  tx_key     TEXT NOT NULL,
  paid       INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (party_id, tx_key)
);
