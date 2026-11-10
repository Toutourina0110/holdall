"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { resolveSlot, type ResolvedItem, type SlotItem } from "@/core/layout/registry";
import type { ElementStyle, SlotId, UserLayout } from "@/core/layout/schema";
import { resetLayoutAction, saveLayoutAction } from "../actions";

type CustomizeState = {
  customizing: boolean;
  saving: boolean;
  error?: string;
  selectedId?: string;
  start(): void;
  cancel(): void;
  save(): void;
  resetAll(): void;
  select(id: string | undefined): void;
  slot(slot: SlotId): ResolvedItem[];
  reorder(slot: SlotId, ids: string[]): void;
  toggleHidden(slot: SlotId, id: string): void;
  setStyle(id: string, style: ElementStyle): void;
  resetElement(id: string): void;
  item(id: string): SlotItem | undefined;
  style(id: string): ElementStyle;
};

const Context = createContext<CustomizeState | null>(null);

function clone(layout: UserLayout): UserLayout {
  return JSON.parse(JSON.stringify(layout)) as UserLayout;
}

export function CustomizeProvider({ items, layout, children }: { items: SlotItem[]; layout: UserLayout; children: ReactNode }) {
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState(layout);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const current = customizing ? draft : layout;

  const update = useCallback((change: (next: UserLayout) => void) => {
    setDraft((previous) => {
      const next = clone(previous);
      change(next);
      return next;
    });
  }, []);

  const value = useMemo<CustomizeState>(
    () => ({
      customizing,
      saving,
      error,
      selectedId,
      start() {
        setDraft(clone(layout));
        setError(undefined);
        setCustomizing(true);
      },
      cancel() {
        setCustomizing(false);
        setSelectedId(undefined);
      },
      save() {
        startSaving(async () => {
          const result = await saveLayoutAction(draft);
          if (result.error) {
            setError(result.error);
            return;
          }
          setCustomizing(false);
          setSelectedId(undefined);
        });
      },
      resetAll() {
        startSaving(async () => {
          await resetLayoutAction();
          setDraft({ version: 1, slots: {}, styles: {} });
          setCustomizing(false);
          setSelectedId(undefined);
        });
      },
      select: setSelectedId,
      slot: (slot) => resolveSlot(slot, items, current),
      reorder(slot, ids) {
        update((next) => {
          next.slots[slot] = { order: ids, hidden: next.slots[slot]?.hidden ?? [] };
        });
      },
      toggleHidden(slot, id) {
        update((next) => {
          const state = next.slots[slot] ?? { order: resolveSlot(slot, items, next).map((item) => item.id), hidden: [] };
          state.hidden = state.hidden.includes(id) ? state.hidden.filter((hidden) => hidden !== id) : [...state.hidden, id];
          next.slots[slot] = state;
        });
      },
      setStyle(id, style) {
        update((next) => {
          next.styles[id] = style;
        });
      },
      resetElement(id) {
        update((next) => {
          delete next.styles[id];
          for (const state of Object.values(next.slots)) {
            if (state) state.hidden = state.hidden.filter((hidden) => hidden !== id);
          }
        });
      },
      item: (id) => items.find((item) => item.id === id),
      style: (id) => current.styles[id] ?? {},
    }),
    [customizing, saving, error, selectedId, layout, items, current, draft, update],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCustomize(): CustomizeState {
  const value = useContext(Context);
  if (!value) throw new Error("useCustomize must be used inside CustomizeProvider.");
  return value;
}
