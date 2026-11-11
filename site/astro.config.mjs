import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://toutourina0110.github.io",
  base: "/holdall",
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
        { label: "Start here", items: ["overview"] },
        {
          label: "Install on a server",
          items: ["install/configuration", "install/docker", "install/coolify", "install/reverse-proxy", "install/calendar-sync", "install/public-demo", "install/troubleshooting"],
        },
        { label: "Desktop app", items: ["desktop/install", "desktop/build"] },
        {
          label: "User guide",
          items: [
            "guide/first-steps",
            "guide/today",
            "guide/notes",
            "guide/tasks",
            "guide/calendar",
            "guide/downloads",
            "guide/files",
            "guide/converter",
            "guide/customize",
            "guide/plugins",
            "guide/account",
          ],
        },
        {
          label: "Write plugins",
          items: [
            "plugins/overview",
            "plugins/tutorial",
            "plugins/manifest",
            "plugins/permissions",
            "plugins/interface",
            "plugins/api",
            "plugins/server-and-hooks",
            "plugins/themes",
            "plugins/tooling",
            "plugins/publishing",
            "plugins/faq",
          ],
        },
        { label: "Contributing", items: ["contributing/development", "contributing/releases"] },
      ],
    }),
  ],
});
