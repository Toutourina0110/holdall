import { registerSlotContributor, type SlotItem } from "@/core/layout/registry";
import { pluginsEnabledFor } from "./store";

registerSlotContributor("plugins", ({ userId }) => {
  const items: SlotItem[] = [];
  for (const installed of pluginsEnabledFor(userId)) {
    if (!installed.granted.has("ui:slots")) continue;
    const { manifest } = installed;
    if (manifest.contributes.page) {
      items.push({
        id: `plugin:${manifest.id}`,
        slot: "rail.main",
        label: manifest.contributes.page.title,
        icon: "plugins",
        href: `/p/${manifest.id}`,
        order: 50,
        source: manifest.id,
      });
    }
    for (const widget of manifest.contributes.widgets) {
      items.push({
        id: `plugin:${manifest.id}:${widget.id}`,
        slot: "dashboard.widgets",
        label: widget.title,
        icon: "plugins",
        order: 100,
        source: manifest.id,
        widget: { pluginId: manifest.id, entry: widget.entry, title: widget.title, width: widget.width },
      });
    }
  }
  return items;
});
