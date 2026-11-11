CREATE VIRTUAL TABLE note_fts USING fts5(note_id UNINDEXED, user_id UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2');
--> statement-breakpoint
CREATE TRIGGER note_fts_after_delete AFTER DELETE ON note BEGIN DELETE FROM note_fts WHERE note_id = old.id; END;
