export default function setup(holdall) {
  holdall.on("notes.saved", async (_payload, context) => {
    const today = new Date().toISOString().slice(0, 10);
    const saved = (await holdall.storage.get("saved", context)) ?? {};
    const count = saved.day === today ? saved.count + 1 : 1;
    await holdall.storage.set("saved", { day: today, count }, context);
  });
}
