import styles from "./SurveyMark.module.css";

export type SurveyMarkState = "open" | "current" | "done" | "late";

export function SurveyMark({ state, size = 22 }: { state: SurveyMarkState; size?: number }) {
  const filled = state === "done";
  return (
    <svg
      className={`${styles.mark} ${styles[state]}`}
      width={size}
      height={size}
      viewBox="0 0 22 22"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 3.5 19 17.5H3z" fill={filled ? "currentColor" : "none"} />
      {filled && <path className={styles.tick} d="m8 13 2 2 4-4.5" fill="none" />}
    </svg>
  );
}
