import type { Metadata } from "next";
import { strings } from "@/core/strings";
import { Panel, PanelEmpty } from "@/ui/Panel";

export const metadata: Metadata = { title: strings.settings.tabPlugins };

export default function PluginSettingsPage() {
  return (
    <Panel title={strings.settings.tabPlugins}>
      <PanelEmpty>{strings.today.emptyBody}</PanelEmpty>
    </Panel>
  );
}
