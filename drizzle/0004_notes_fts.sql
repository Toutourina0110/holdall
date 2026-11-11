CREATE VIRTUAL TABLE note_fts USING fts5(note_id UNINDEXED, user_id UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2');
