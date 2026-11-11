import { registerSlotContributor, type SlotItem } from "@/core/layout/registry";
import { signAssetToken } from "./asset-token";
import { pluginsEnabledFor } from "./store";

registerSlotContributor("plugins", ({ userId }) => {
  const items: SlotItem[] = [];
  for (const installed of pluginsEnabledFor(userId)) {
    if (!installed.granted.has("ui:slots")) continue;
    const { manifest } = installed;
    const page = manifest.contributes.page;
    if (page) {
      const base = `/p/${manifest.id}`;
      items.push({
        id: `plugin:${manifest.id}`,
        slot: "rail.main",
        label: page.title,
        icon: "plugins",
        iconUrl: page.icon ? `/api/plugins/${manifest.id}/ui/${signAssetToken(manifest.id, userId)}/${page.icon}` : undefined,
        href: base,
        order: 50,
        source: manifest.id,
        children: page.pages.length > 0 ? page.pages.map((sub) => ({ label: sub.title, href: `${base}/${sub.path}` })) : undefined,
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
