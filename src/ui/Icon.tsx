import styles from "./Icon.module.css";

const paths = {
  today: ["M8 2.5 14 13H2z", "M8 7v3"],
  notes: ["M3.5 2.5h9v11h-9z", "M6 6h4M6 8.5h4M6 11h2"],
  tasks: ["M5 3.5 8 9H2z", "M10 6h4M10 11h4M2.5 12h5"],
  calendar: ["M2.5 3.5h11v10h-11z", "M2.5 7h11M6 2v3M10 2v3"],
  downloads: ["M2 12.5h12", "M8 2.5v7M5 7l3 3 3-3"],
  converter: ["M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5"],
  files: ["M2.5 4.5h4l1.5 1.5h5.5v7h-11z"],
  plugins: ["M6 2.5v3M10 2.5v3M4.5 5.5h7v3a3.5 3.5 0 0 1-7 0zM8 12v2"],
  settings: ["M8 5.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z", "M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6 5 5M11 11l1.4 1.4M3.6 12.4 5 11M11 5l1.4-1.4"],
  admin: ["M8 1.8 13.5 4v4c0 3-2.3 5.4-5.5 6.2C4.8 13.4 2.5 11 2.5 8V4z", "M5.8 8l1.6 1.6 3-3.2"],
  search: ["M7 2.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4z", "m10.2 10.2 3.3 3.3"],
  plus: ["M8 3.5v9M3.5 8h9"],
  link: ["M7 9 9 7M6 7.5 4.5 9a2.1 2.1 0 0 0 3 3L9 10.5M10 8.5 11.5 7a2.1 2.1 0 0 0-3-3L7 5.5"],
  user: ["M8 2.5a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z", "M2.8 13.5c.6-2.4 2.7-3.8 5.2-3.8s4.6 1.4 5.2 3.8"],
  logout: ["M6 2.5H3v11h3", "M10 5l3 3-3 3M6.5 8H13"],
  grip: ["M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01"],
  eye: ["M1.8 8S4 3.5 8 3.5 14.2 8 14.2 8 12 12.5 8 12.5 1.8 8 1.8 8z", "M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"],
  eyeOff: ["M2.5 2.5l11 11", "M6.5 4c.5-.3 1-.5 1.5-.5 4 0 6.2 4.5 6.2 4.5s-.6 1.2-1.7 2.4M10.6 11.6c-.8.6-1.7.9-2.6.9-4 0-6.2-4.5-6.2-4.5s.8-1.7 2.4-3"],
  reset: ["M3 8a5 5 0 1 0 1.5-3.6", "M3 2.5V5h2.5"],
  upload: ["M8 10V2.5M5 5.5l3-3 3 3", "M2.5 10.5v3h11v-3"],
  download: ["M8 2.5V10M5 7l3 3 3-3", "M2.5 10.5v3h11v-3"],
  pause: ["M6 4v8M10 4v8"],
  play: ["M5.5 3.5v9l7-4.5z"],
  x: ["m4.5 4.5 7 7M11.5 4.5l-7 7"],
  check: ["m3.5 8.5 3 3 6-7"],
  chevron: ["m5 6.5 3 3 3-3"],
  sun: ["M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5"],
  layout: ["M2.5 2.5h11v11h-11z", "M6.5 2.5v11M6.5 7h7"],
  palette: ["M8 2a6 6 0 1 0 0 12c1 0 1.3-.7 1-1.5-.4-.9.1-1.5 1-1.5h1.5A2.5 2.5 0 0 0 14 8.5C14 5 11.3 2 8 2z", "M5 7.5h.01M6.5 5h.01M9.5 5h.01"],
  sync: ["M13 8a5 5 0 0 1-9 3M3 8a5 5 0 0 1 9-3M12 2.5V5H9.5M4 13.5V11h2.5"],
  copy: ["M5.5 5.5h7v7h-7z", "M3.5 10.5v-7h7"],
  trash: ["M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"],
  bold: ["M4.5 3h4.5a2.5 2.5 0 0 1 0 5H4.5zM4.5 8h5a2.5 2.5 0 0 1 0 5h-5z"],
  italic: ["M7 3h5M4 13h5M9.5 3 6.5 13"],
  strike: ["M3 8h10M10.5 4.5C10 3.6 9.1 3 8 3 6.3 3 5 4 5 5.3c0 .9.5 1.6 1.4 2M5.5 11.5c.5.9 1.4 1.5 2.5 1.5 1.7 0 3-1 3-2.3"],
  heading: ["M3.5 3v10M10.5 3v10M3.5 8h7M12.5 7.5l1.5-1v6.5"],
  listBullet: ["M6 4h8M6 8h8M6 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01"],
  listNumber: ["M7 4h7M7 8h7M7 12h7M2.5 3l1-.5V6M2.3 9.5c.3-.6 1.7-.6 1.7.3 0 .8-1.7 1.2-1.7 2.2h1.8"],
  checklist: ["M2.5 4l1 1 2-2M2.5 9.5l1 1 2-2M8 4h6M8 9.5h6M8 13h6"],
  quote: ["M3 4h3v3c0 2-1 3.5-3 4M9 4h3v3c0 2-1 3.5-3 4"],
  codeBlock: ["M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"],
  table: ["M2.5 3h11v10h-11zM2.5 6.5h11M2.5 10h11M7 3v10"],
  image: ["M2.5 3h11v10h-11z", "M2.5 11l3.5-3.5 3 3 2-2 2.5 2.5M10.5 6h.01"],
  pin: ["M6 2.5h4M7 2.5v4L4.5 9h7L9 6.5v-4M8 9v4.5"],
  star: ["M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4-2.9-2.8 4-.6z"],
  history: ["M3 8a5 5 0 1 0 1.5-3.6", "M3 2.5V5h2.5M8 5v3l2 1.5"],
  back: ["M10 3.5 5.5 8l4.5 4.5"],
  folder: ["M2.5 4.5h4l1.5 1.5h5.5v7h-11z"],
  tag: ["M2.5 2.5h5l6 6-5 5-6-6z", "M5.5 5.5h.01"],
  alert: ["M8 2.5 14 13H2z", "M8 6.5v3M8 11.2h.01"],
  bell: ["M4 11V7.2a4 4 0 0 1 8 0V11l1.2 1.5H2.8z", "M6.6 14a1.5 1.5 0 0 0 2.8 0"],
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className={styles.icon}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
