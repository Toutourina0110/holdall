import { z } from "zod";
import type { SlotItem } from "@/core/layout/registry";
import { createLogger } from "@/core/log";
import { applyFilters, listeningPlugins } from "./hooks";
import { callPluginHook } from "./host";
import { getInstalledPlugin } from "./store";

const log = createLogger("hooks");

type WidgetRef = { id: string; label: string };

export async function filterDashboardWidgets(items: SlotItem[], userId: string): Promise<SlotItem[]> {
  const widgets: WidgetRef[] = items.filter((item) => item.slot === "dashboard.widgets").map((item) => ({ id: item.id, label: item.label }));
  if (widgets.length === 0) return items;
  const known = new Set(widgets.map((widget) => widget.id));
  const isSubset = (next: unknown): next is WidgetRef[] =>
    Array.isArray(next) && next.length <= widgets.length && next.every((entry) => typeof entry?.id === "string" && known.has(entry.id));
  const kept = new Set((await applyFilters("dashboard.widgets", widgets, { userId }, isSubset)).map((widget) => widget.id));
  return items.filter((item) => item.slot !== "dashboard.widgets" || kept.has(item.id));
}

export type RenderedEvent = { id: string; title: string; color: string };

const renderedEvent = z.object({
  id: z.string(),
  title: z.string().max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function filterCalendarEvents(events: RenderedEvent[], userId: string): Promise<RenderedEvent[]> {
  if (events.length === 0) return events;
  const sameEvents = (next: unknown): next is RenderedEvent[] => {
    const parsed = z.array(renderedEvent).safeParse(next);
    return parsed.success && parsed.data.length === events.length && parsed.data.every((event, index) => event.id === events[index]!.id);
  };
  return applyFilters("calendar.event.render", events, { userId }, sameEvents);
}

const exportFormat = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,30}$/),
  label: z.string().trim().min(1).max(40),
  extension: z.string().regex(/^[a-z0-9]{1,10}$/),
});

export type ExportFormat = z.infer<typeof exportFormat> & { pluginId: string; pluginName: string };

export async function noteExportFormats(userId: string): Promise<ExportFormat[]> {
  const formats: ExportFormat[] = [];
  for (const pluginId of await listeningPlugins("notes.export.formats", userId)) {
    try {
      const parsed = z.array(exportFormat).max(5).safeParse(await callPluginHook(pluginId, "notes.export.formats", [], userId));
      if (!parsed.success) {
        log.warn("Plugin returned invalid export formats", { pluginId });
        continue;
      }
      const pluginName = getInstalledPlugin(pluginId)?.manifest.name ?? pluginId;
      formats.push(...parsed.data.map((format) => ({ ...format, pluginId, pluginName })));
    } catch (error) {
      log.warn("Plugin export formats failed", { pluginId, error: String(error) });
    }
  }
  return formats;
}

export async function renderNoteExport(
  userId: string,
  pluginId: string,
  formatId: string,
  note: { id: string; title: string; content: string },
): Promise<{ content: string; extension: string } | undefined> {
  const format = (await noteExportFormats(userId)).find((item) => item.pluginId === pluginId && item.id === formatId);
  if (!format || !(await listeningPlugins("notes.export.render", userId)).includes(pluginId)) return undefined;
  const result = z
    .object({ content: z.string().max(5 * 1024 * 1024) })
    .safeParse(await callPluginHook(pluginId, "notes.export.render", { format: formatId, note }, userId, 15000));
  if (!result.success) {
    log.warn("Plugin returned an invalid export", { pluginId, formatId });
    return undefined;
  }
  return { content: result.data.content, extension: format.extension };
}
