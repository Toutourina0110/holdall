"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { strings } from "@/core/strings";
import { Segmented } from "@/ui/controls";
import { Icon, type IconName } from "@/ui/Icon";
import { saveNoteAction } from "./actions";
import styles from "./notes.module.css";

type SaveState = "saved" | "saving" | "unsaved" | "failed";

function ToolButton({ icon, label, active, onClick }: { icon: IconName; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={styles.tool} aria-label={label} title={label} aria-pressed={active} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = strings.notes;
  const chain = () => editor.chain().focus();
  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t.toolbar}>
      <ToolButton icon="bold" label={t.bold} active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon="italic" label={t.italic} active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon="strike" label={t.strike} active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()} />
      <ToolButton icon="heading" label={t.heading} active={editor.isActive("heading")} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon="listBullet" label={t.bulletList} active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon="listNumber" label={t.orderedList} active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon="checklist" label={t.checkList} active={editor.isActive("taskList")} onClick={() => chain().toggleTaskList().run()} />
      <ToolButton icon="quote" label={t.quote} active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} />
      <ToolButton icon="codeBlock" label={t.code} active={editor.isActive("codeBlock")} onClick={() => chain().toggleCodeBlock().run()} />
      <ToolButton icon="table" label={t.table} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <ToolButton
        icon="link"
        label={t.link}
        active={editor.isActive("link")}
        onClick={() => {
          const href = window.prompt(t.linkPrompt, String(editor.getAttributes("link").href ?? "https://"));
          if (href === null) return;
          if (!href) chain().unsetLink().run();
          else if (/^(https?:|mailto:|\/)/i.test(href)) chain().extendMarkRange("link").setLink({ href }).run();
        }}
      />
      <ToolButton
        icon="image"
        label={t.image}
        onClick={() => {
          const src = window.prompt(t.imagePrompt, "https://");
          if (src && /^(https?:|\/)/i.test(src)) chain().setImage({ src }).run();
        }}
      />
    </div>
  );
}

export function NoteEditor({ id, initialTitle, initialContent, readOnly }: { id: string; initialTitle: string; initialContent: string; readOnly: boolean }) {
  const t = strings.notes;
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<"rich" | "markdown">("rich");
  const [state, setState] = useState<SaveState>("saved");
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saving = useRef(false);

  const flush = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    while (pending.current.title !== undefined || pending.current.content !== undefined) {
      const change = pending.current;
      pending.current = {};
      setState("saving");
      const result = await saveNoteAction(id, change).catch(() => ({ error: "failed" }));
      if ("error" in result && result.error) {
        pending.current = { ...change, ...pending.current };
        saving.current = false;
        setState("failed");
        return;
      }
    }
    saving.current = false;
    setState("saved");
  }, [id]);

  const queue = useCallback(
    (change: { title?: string; content?: string }) => {
      pending.current = { ...pending.current, ...change };
      setState("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: initialContent,
    contentType: "markdown",
    editorProps: { attributes: { class: styles.prose ?? "", "aria-label": t.title } },
    onUpdate({ editor: current }) {
      const markdown = current.getMarkdown();
      setContent(markdown);
      queue({ content: markdown });
    },
  });

  function switchMode(next: "rich" | "markdown") {
    if (next === "rich" && editor) editor.commands.setContent(content, { contentType: "markdown", emitUpdate: false });
    setMode(next);
  }

  const status = { saved: t.saved, saving: t.saving, unsaved: t.unsaved, failed: t.saveFailed }[state];

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <input
          className={styles.titleInput}
          aria-label={t.titleLabel}
          value={title}
          readOnly={readOnly}
          maxLength={200}
          placeholder={t.untitled}
          onChange={(event) => {
            setTitle(event.target.value);
            queue({ title: event.target.value });
          }}
        />
        <span className={styles.status} data-state={state} role="status">
          {status}
        </span>
      </div>
      {!readOnly && (
        <div className={styles.modeBar}>
          {mode === "rich" && editor ? <Toolbar editor={editor} /> : <span />}
          <Segmented label={t.title} value={mode} onChange={switchMode} options={[{ value: "rich", label: t.rich }, { value: "markdown", label: t.markdown }]} />
        </div>
      )}
      {mode === "rich" ? (
        <EditorContent editor={editor} className={styles.surface} />
      ) : (
        <textarea
          className={styles.raw}
          aria-label={t.markdown}
          value={content}
          spellCheck={false}
          onChange={(event) => {
            setContent(event.target.value);
            queue({ content: event.target.value });
          }}
        />
      )}
    </div>
  );
}
