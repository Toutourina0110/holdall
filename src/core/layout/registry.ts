import type { IconName } from "@/ui/Icon";
import type { ElementStyle, SlotId, UserLayout } from "./schema";

export type SlotItem = {
  id: string;
  slot: SlotId;
  label: string;
  icon: IconName;
  href?: string;
  order: number;
  source: string;
  widget?: { pluginId: string; entry: string; title: string };
};

export type ResolvedItem = SlotItem & { hidden: boolean; style: ElementStyle };

const contributors: ((context: { userId: string; isAdmin: boolean }) => SlotItem[])[] = [];

export function registerSlotContributor(contributor: (context: { userId: string; isAdmin: boolean }) => SlotItem[]): void {
  contributors.push(contributor);
}

function coreItems(isAdmin: boolean): SlotItem[] {
  const items: SlotItem[] = [
    { id: "core.today", slot: "rail.main", label: "Today", icon: "today", href: "/", order: 0, source: "core" },
    { id: "core.plugins", slot: "rail.system", label: "Plugins", icon: "plugins", href: "/settings/plugins", order: 80, source: "core" },
    { id: "core.settings", slot: "rail.system", label: "Settings", icon: "settings", href: "/settings", order: 90, source: "core" },
  ];
  if (isAdmin) items.push({ id: "core.admin", slot: "rail.system", label: "Admin", icon: "admin", href: "/admin", order: 95, source: "core" });
  return items;
}

export function slotItemsFor(context: { userId: string; isAdmin: boolean }): SlotItem[] {
  return [...coreItems(context.isAdmin), ...contributors.flatMap((contribute) => contribute(context))];
}

export function resolveSlot(slot: SlotId, items: SlotItem[], layout: UserLayout): ResolvedItem[] {
  const own = items.filter((item) => item.slot === slot).sort((a, b) => a.order - b.order);
  const state = layout.slots[slot];
  const order = state?.order ?? [];
  const rank = (id: string) => {
    const position = order.indexOf(id);
    return position === -1 ? order.length + own.findIndex((item) => item.id === id) : position;
  };
  return [...own]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((item) => ({ ...item, hidden: state?.hidden.includes(item.id) ?? false, style: layout.styles[item.id] ?? {} }));
}
