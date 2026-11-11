import { registerSlotContributor } from "@/core/layout/registry";
import "@/modules/converter/jobs";

registerSlotContributor("files", () => [
  { id: "files.page", slot: "rail.media", label: "Files", icon: "files", href: "/files", order: 20, source: "files" },
  { id: "converter.page", slot: "rail.media", label: "Converter", icon: "converter", href: "/converter", order: 30, source: "converter" },
]);
