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
  widget?: { pluginId: string; entry: string; title: string; width?: 1 | 2 | 3 };
  builtin?: { component: string; width?: 1 | 2 | 3 };
};

export type ResolvedItem = SlotItem & { hidden: boolean; style: ElementStyle };

type Contributor = (context: { userId: string; isAdmin: boolean }) => SlotItem[];

const globalKey = Symbol.for("holdall.slotContributors");
const store = globalThis as unknown as Record<symbol, Map<string, Contributor> | undefined>;
const contributors: Map<string, Contributor> = (store[globalKey] ??= new Map());

export function registerSlotContributor(key: string, contributor: Contributor): void {
  contributors.set(key, contributor);
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
  return [...coreItems(context.isAdmin), ...[...contributors.values()].flatMap((contribute) => contribute(context))];
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
