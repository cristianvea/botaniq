import * as db from './data.js';
import { reminderStatus } from './reminders.js';

// Recordatorios que tocan con este riego (abono…): se dan por hechos al regar
export function dueWithWatering(ctx, plant) {
  return (ctx.reminders || []).filter((r) => r.plant_id === plant.id && r.mode === 'with_watering' && reminderStatus(r, ctx.events).due);
}

export async function waterPlants(ctx, plants) {
  const created = [];
  const done = [];
  try {
    for (const p of plants) {
      const due = dueWithWatering(ctx, p);
      created.push(await db.addEvent(p, 'water', ctx.user.id));
      for (const r of due) {
        await db.updateReminder(r.id, { last_done_at: new Date().toISOString() }).catch(() => {});
        done.push(r);
      }
    }
    await ctx.reload();
    let text = plants.length === 1 ? `💧 ${plants[0].name} regada` : `💧 ${plants.length} plantas regadas`;
    if (done.length) text += ` · 🌱 ${[...new Set(done.map((r) => r.title.toLowerCase()))].join(', ')} anotado`;
    ctx.notify(text, {
      label: 'Deshacer',
      run: async () => {
        for (const e of created) await db.deleteEvent(e);
        for (const r of done) await db.updateReminder(r.id, { last_done_at: r.last_done_at || null }).catch(() => {});
        await ctx.reload();
      },
    });
  } catch (e) {
    ctx.notify(e.message);
  }
}

export async function mistPlants(ctx, plants) {
  try {
    for (const p of plants) await db.addEvent(p, 'mist', ctx.user.id);
    await ctx.reload();
    ctx.notify(plants.length === 1 ? `💦 ${plants[0].name} pulverizada` : `💦 ${plants.length} plantas pulverizadas`);
  } catch (e) {
    ctx.notify(e.message);
  }
}

export async function completeReminder(ctx, r) {
  try {
    await db.updateReminder(r.id, { last_done_at: new Date().toISOString() });
    await ctx.reload();
    ctx.notify(`🌱 ${r.title}: hecho`, {
      label: 'Deshacer',
      run: async () => { await db.updateReminder(r.id, { last_done_at: r.last_done_at || null }); await ctx.reload(); },
    });
  } catch (e) {
    ctx.notify(e.message);
  }
}
