import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://holdall.site",
  integrations: [
    starlight({
      title: "Holdall",
      description: "Documentation for Holdall, the self-hosted personal toolbox.",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/Toutourina0110/holdall" }],
      editLink: { baseUrl: "https://github.com/Toutourina0110/holdall/edit/main/site/" },
      customCss: [
        "@fontsource/ibm-plex-sans/400.css",
        "@fontsource/ibm-plex-sans/600.css",
        "@fontsource/ibm-plex-sans/700.css",
        "./src/styles/holdall.css",
      ],
      sidebar: [
        { label: "Start here", items: ["docs", "docs/overview"] },
        {
          label: "Install on a server",
          items: ["docs/install/configuration", "docs/install/docker", "docs/install/coolify", "docs/install/reverse-proxy", "docs/install/calendar-sync", "docs/install/public-demo", "docs/install/troubleshooting"],
        },
        { label: "Desktop app", items: ["docs/desktop/install", "docs/desktop/build"] },
        {
          label: "User guide",
          items: [
            "docs/guide/first-steps",
            "docs/guide/today",
            "docs/guide/notes",
            "docs/guide/tasks",
            "docs/guide/calendar",
            "docs/guide/downloads",
            "docs/guide/files",
            "docs/guide/converter",
            "docs/guide/customize",
            "docs/guide/plugins",
            "docs/guide/account",
          ],
        },
        {
          label: "Write plugins",
          items: [
            "docs/plugins/overview",
            "docs/plugins/tutorial",
            "docs/plugins/manifest",
            "docs/plugins/permissions",
            "docs/plugins/interface",
            "docs/plugins/api",
            "docs/plugins/server-and-hooks",
            "docs/plugins/themes",
            "docs/plugins/tooling",
            "docs/plugins/publishing",
            "docs/plugins/faq",
          ],
        },
        { label: "Contributing", items: ["docs/contributing/development", "docs/contributing/releases"] },
      ],
    }),
  ],
});
