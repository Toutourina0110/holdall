import type { Metadata } from "next";
import { strings } from "@/core/strings";
import { LayoutTools } from "./LayoutTools";

export const metadata: Metadata = { title: strings.settings.tabLayout };

export default function LayoutSettingsPage() {
  return <LayoutTools />;
}
