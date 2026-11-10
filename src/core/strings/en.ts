export const en = {
  app: {
    name: "Holdall",
    description:
      "Self-hosted personal toolbox: notes, tasks, calendar, video downloads and files, on your desktop or your own server.",
    version: "Version",
  },
  home: {
    crumb: "Setup",
    heading: "Holdall is being built",
    intro:
      "Nothing is usable yet. This page only shows that the project builds and runs. Features arrive phase by phase, in the order below.",
    roadmapTitle: "Roadmap",
    roadmapCount: "9 phases",
    status: {
      done: "Done",
      current: "In progress",
      planned: "Planned",
    },
    phaseLabel: "Phase",
    phases: [
      { name: "Setup", detail: "Project, tooling, tests and continuous integration" },
      { name: "Core", detail: "Accounts, roles, customizable layout, themes, plugins, background jobs" },
      { name: "Notes and tasks", detail: "Markdown notes with search, task lists with due dates" },
      { name: "Packaging", detail: "Docker image and desktop apps for Windows, macOS and Linux" },
      { name: "Video downloader", detail: "Download video and audio from links, playlists and channels" },
      { name: "Converter and files", detail: "Convert files and manage them in one place" },
      { name: "Synced calendar", detail: "Google, Outlook, iCloud and CalDAV calendars" },
      { name: "Plugin store", detail: "Install plugins and themes from a public registry" },
      { name: "Public demo", detail: "A demo instance with sample data, reset regularly" },
    ],
  },
  notFound: {
    title: "Page not found",
    crumb: "Not found",
    heading: "This page does not exist",
    body: "The address does not match any page in Holdall. Check the link, or go back to the start page.",
    back: "Go to the start page",
  },
} as const;
