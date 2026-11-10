"use client";

import { useRef, useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Notice } from "@/ui/controls";
import { Panel, PanelForm } from "@/ui/Panel";
import { resetLayoutAction } from "../../actions";
import { exportLayoutAction, importLayoutAction } from "./actions";

export function LayoutTools() {
  const t = strings.layoutSettings;
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string }>();
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function download() {
    start(async () => {
      const json = await exportLayoutAction();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      link.download = "holdall-layout.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  function upload(file: File) {
    start(async () => {
      const result = await importLayoutAction(await file.text());
      setMessage(result.error ? { tone: "error", text: t.importFailed } : { tone: "success", text: t.imported });
    });
  }

  function reset() {
    start(async () => {
      await resetLayoutAction();
      setMessage({ tone: "success", text: t.resetDone });
    });
  }

  return (
    <Panel title={t.title}>
      <PanelForm>
        <p>{t.intro}</p>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <Button icon="download" onClick={download} disabled={pending}>
          {t.export}
        </Button>
        <Button icon="upload" onClick={() => fileInput.current?.click()} disabled={pending}>
          {t.import}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
        <Button variant="danger" icon="reset" onClick={reset} disabled={pending}>
          {t.reset}
        </Button>
      </PanelForm>
    </Panel>
  );
}
