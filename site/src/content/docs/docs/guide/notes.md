---
title: Notes
description: Write Markdown notes with folders, tags, links between notes, history and checklists.
---

Notes are plain Markdown files. On a server they are in the data folder under `notes/<your account>/`, so you can always read them without Holdall.

## Write

**New note** creates a note. Type in the editor; the note is saved as you write, and the status shows **Saving**, **Saved** or **Not saved yet**. If saving fails, check your connection and keep typing to retry.

The editor has two modes:

- **Rich**: formatting buttons for bold, italic, strikethrough, headings, lists, checklists, quotes, code blocks, tables, links and images;
- **Markdown**: the raw text.

## Organize

Open **Details** on a note to set:

- a **folder**, with `/` for subfolders, for example `Work/Reports`;
- **tags**, separated by commas.

The left column lists **All notes**, **Favorites**, **Folders**, **Tags** and **Trash**. **Pin** keeps a note at the top of the list. **Search notes** searches titles and text.

## Link notes

Write `[[Title of another note]]` to link to it. In **Details**:

- **Links to** lists the notes this one links to, and marks missing ones as **not found**;
- **Linked from** lists the notes that link here.

## History

While you edit, Holdall keeps a version every 10 minutes. Open **History** to see them and **Restore** one. The current text is kept in the history, so restoring never loses anything.

## Checklists and tasks

Lines like `- [ ] Call the bank` are checklist items. **Details** lists them, and **Make task** turns one into a task in **Tasks**, linked back to the note.

## Trash

**Move to trash** hides a note without deleting it. From **Trash**, **Restore** brings it back and **Delete for good** removes it. **Empty trash** deletes every note in the trash for good.

## Import and export

- **Import .md or .zip** adds Markdown files, or a zip of Markdown files with their folders.
- **Export** downloads one note as `.md`. **Export as zip** downloads the folder you are in, or every note.
- Plugins you turned on can add more export formats: they appear as extra buttons next to **Export**.
