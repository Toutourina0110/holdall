import { strings } from "@/core/strings";
import { PageFrame } from "@/ui/PageFrame";
import { SurveyMark, type SurveyMarkState } from "@/ui/SurveyMark";
import styles from "./page.module.css";

const currentPhase = 0;

function phaseState(index: number): SurveyMarkState {
  if (index < currentPhase) return "done";
  if (index === currentPhase) return "current";
  return "open";
}

const statusLabel: Record<SurveyMarkState, string> = {
  done: strings.home.status.done,
  current: strings.home.status.current,
  open: strings.home.status.planned,
  late: strings.home.status.planned,
};

export default function HomePage() {
  const t = strings.home;
  return (
    <PageFrame
      crumb={t.crumb}
      aside={
        <span className={styles.chip}>
          {strings.app.version} <span className="num">0.0.1</span>
        </span>
      }
    >
      <div className={styles.head}>
        <h1 className={styles.title}>{t.heading}</h1>
        <p className={styles.intro}>{t.intro}</p>
      </div>

      <section className={styles.panel} aria-labelledby="roadmap-title">
        <div className={styles.panelHead}>
          <h2 id="roadmap-title" className={styles.panelTitle}>
            {t.roadmapTitle}
          </h2>
          <span className={styles.count}>{t.roadmapCount}</span>
        </div>
        <ol className={styles.phases}>
          {t.phases.map((phase, index) => {
            const state = phaseState(index);
            return (
              <li key={phase.name} className={styles.phase} data-state={state}>
                <SurveyMark state={state} />
                <span className={`${styles.index} num`}>
                  {t.phaseLabel} {index}
                </span>
                <span className={styles.name}>{phase.name}</span>
                <span className={styles.detail}>{phase.detail}</span>
                <span className={styles.status}>{statusLabel[state]}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </PageFrame>
  );
}
