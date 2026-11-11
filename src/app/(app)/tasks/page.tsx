import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { Icon, type IconName } from "@/ui/Icon";
import { listTaskLists, type TaskView } from "@/modules/tasks/store";
import { DeleteListButton, NewListForm } from "./ListTools";
import { TaskBoard } from "./TaskBoard";
import styles from "./tasks.module.css";

export const metadata: Metadata = { title: strings.tasks.title };

const views: { view: Exclude<TaskView, "list">; icon: IconName }[] = [
  { view: "today", icon: "today" },
  { view: "upcoming", icon: "calendar" },
  { view: "inbox", icon: "tasks" },
  { view: "done", icon: "check" },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; list?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const t = strings.tasks;
  const lists = listTaskLists(session.user.id).map(({ id, name }) => ({ id, name }));
  const list = params.list ? lists.find((item) => item.id === params.list) : undefined;
  const view: TaskView = list ? "list" : views.some((item) => item.view === params.view) ? (params.view as TaskView) : "today";
  const heading = list ? list.name : t[view as Exclude<TaskView, "list">];

  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label={t.title}>
        <ul className={styles.navList}>
          {views.map((item) => (
            <li key={item.view}>
              <Link href={`/tasks?view=${item.view}`} aria-current={view === item.view ? "page" : undefined}>
                <Icon name={item.icon} /> {t[item.view]}
              </Link>
            </li>
          ))}
        </ul>
        <h2 className={styles.navTitle}>{t.lists}</h2>
        <ul className={styles.navList}>
          {lists.map((item) => (
            <li key={item.id}>
              <Link href={`/tasks?list=${item.id}`} aria-current={list?.id === item.id ? "page" : undefined}>
                <Icon name="listBullet" /> {item.name}
              </Link>
            </li>
          ))}
        </ul>
        <NewListForm />
      </nav>
      <div className={styles.content}>
        <header className={styles.head}>
          <h1>{heading}</h1>
          {list && <DeleteListButton id={list.id} />}
        </header>
        <TaskBoard key={`${view}-${list?.id ?? ""}`} view={view} listId={list?.id} lists={lists} />
      </div>
    </div>
  );
}
