import { createEvent, localCalendar } from "@/modules/calendar/store";
import { createNote } from "@/modules/notes/store";
import { createTask, taskInput } from "@/modules/tasks/store";

function day(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function at(offset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const notes = [
  {
    title: "Welcome to Holdall",
    folder: "",
    content: `This is a demo account. Everything here is made up and is deleted regularly.

## Try this

- [ ] Open [[Weekly review]] and tick an item
- [ ] Add a task for today in Tasks
- [ ] Drag a widget in Customize mode
- [ ] Switch to dark mode in Settings, Appearance

Notes are plain Markdown files. Link notes with double brackets, like [[Trip to Lisbon]].
`,
  },
  {
    title: "Weekly review",
    folder: "Planning",
    content: `## Done this week

- Moved the photo backup to the new disk
- Sent the invoice for October

## Next week

- [ ] Renew the passport
- [ ] Book the dentist
- [x] Clean the downloads folder

| Area | Status |
| --- | --- |
| Home | on track |
| Work | busy |
`,
  },
  {
    title: "Trip to Lisbon",
    folder: "Travel",
    content: `## Plan

1. Tram 28 early in the morning
2. Lunch at the market
3. Sunset at the viewpoint

> Pack light, the streets are steep.

Budget: 600 EUR for 4 days.
`,
  },
  {
    title: "Recipe: lentil soup",
    folder: "Kitchen",
    content: `- 200 g red lentils
- 1 onion, 2 carrots
- 1 l vegetable stock
- cumin, lemon

Cook 25 minutes, blend half, add lemon at the end.
`,
  },
];

const tasks = [
  { title: "Call the bank about the card", dueDate: day(0), dueTime: "10:00", priority: 2 },
  { title: "Water the plants", dueDate: day(0), priority: 0, labels: ["home"] },
  { title: "Send the quarterly report", dueDate: day(-1), priority: 3, labels: ["work"] },
  { title: "Renew the passport", dueDate: day(3), priority: 1 },
  { title: "Buy a birthday present for Sam", dueDate: day(5), priority: 1, labels: ["family"] },
  { title: "Read the new book chapter", priority: 0 },
];

const events = [
  { title: "Team standup", start: at(0, 9, 30), end: at(0, 9, 45), location: "Video call" },
  { title: "Lunch with Alex", start: at(0, 12, 30), end: at(0, 13, 30), location: "Corner cafe" },
  { title: "Dentist", start: at(1, 16), end: at(1, 16, 45) },
  { title: "Yoga", start: at(2, 18), end: at(2, 19) },
  { title: "Project review", start: at(3, 14), end: at(3, 15, 30), description: "Bring the numbers for October." },
  { title: "Weekend trip", start: new Date(`${day(5)}T00:00:00Z`), end: new Date(`${day(7)}T00:00:00Z`), allDay: true },
];

export function seedDemo(userId: string): void {
  for (const note of notes) createNote(userId, note);
  for (const task of tasks) createTask(userId, taskInput.parse(task));
  const calendarId = localCalendar(userId).id;
  for (const event of events) createEvent(userId, { calendarId, ...event });
}
