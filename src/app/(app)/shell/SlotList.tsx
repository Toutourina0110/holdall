"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import type { CSSProperties, ReactNode } from "react";
import type { ResolvedItem } from "@/core/layout/registry";
import type { SlotId } from "@/core/layout/schema";
import { Icon } from "@/ui/Icon";
import { useCustomize } from "./CustomizeContext";
import styles from "./shell.module.css";

export function itemStyle(item: ResolvedItem): CSSProperties {
  return {
    "--item-color": item.style.color,
    "--item-background": item.style.background,
  } as CSSProperties;
}

function EditableRow({ item, index, slot, children }: { item: ResolvedItem; index: number; slot: SlotId; children: ReactNode }) {
  const customize = useCustomize();
  const { ref, handleRef, isDragging } = useSortable({ id: item.id, index, group: slot });
  return (
    <li
      ref={ref}
      className={styles.editable}
      data-dragging={isDragging || undefined}
      data-hidden={item.hidden || undefined}
      data-selected={customize.selectedId === item.id || undefined}
    >
      <button ref={handleRef} type="button" className={styles.handle} aria-label={`Move ${item.label}`}>
        <Icon name="grip" />
      </button>
      <button type="button" className={styles.editTarget} onClick={() => customize.select(item.id)} aria-label={`Style ${item.label}`}>
        {children}
      </button>
      <button
        type="button"
        className={styles.handle}
        aria-label={item.hidden ? `Show ${item.label}` : `Hide ${item.label}`}
        aria-pressed={item.hidden}
        onClick={() => customize.toggleHidden(slot, item.id)}
      >
        <Icon name={item.hidden ? "eyeOff" : "eye"} />
      </button>
    </li>
  );
}

export function SlotList({
  slot,
  className,
  render,
}: {
  slot: SlotId;
  className?: string;
  render: (item: ResolvedItem) => ReactNode;
}) {
  const customize = useCustomize();
  const items = customize.slot(slot);
  if (!customize.customizing) {
    const visible = items.filter((item) => !item.hidden);
    if (visible.length === 0) return null;
    return (
      <ul className={className}>
        {visible.map((item) => (
          <li key={item.id}>{render(item)}</li>
        ))}
      </ul>
    );
  }
  if (items.length === 0) return null;
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        customize.reorder(slot, move(items.map((item) => item.id), event));
      }}
    >
      <ul className={`${className ?? ""} ${styles.editing}`}>
        {items.map((item, index) => (
          <EditableRow key={item.id} item={item} index={index} slot={slot}>
            {render(item)}
          </EditableRow>
        ))}
      </ul>
    </DragDropProvider>
  );
}
