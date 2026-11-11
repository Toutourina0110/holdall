const goal = 500;

function countWords(markdown) {
  const text = markdown.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`[\]()|-]/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

export default function setup(holdall) {
  holdall.on("notes.saved", async ({ id }, context) => {
    const note = await holdall.api("notes.get", { id }, context);
    if (!note) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `day:${today}`;
    const day = (await holdall.storage.get(key, context)) ?? { notes: {}, notified: false };
    day.notes[id] = countWords(note.content);
    const total = Object.values(day.notes).reduce((sum, words) => sum + words, 0);
    if (total >= goal && !day.notified) {
      day.notified = true;
      try {
        await holdall.api("notifications.show", { title: `You wrote ${total} words today`, body: `Your goal was ${goal} words.` }, context);
      } catch (error) {
        holdall.log(`No notification sent: ${error.message}`);
      }
    }
    await holdall.storage.set(key, day, context);
    const days = (await holdall.storage.get("days", context)) ?? [];
    if (!days.includes(today)) await holdall.storage.set("days", [today, ...days].slice(0, 30), context);
  });
}
