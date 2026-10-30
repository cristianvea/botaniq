import * as db from './data.js';
import { reminderStatus } from './reminders.js';
import { adjustAfterWetCheck, learnFromEarlyWatering } from './watering.js';

// Recordatorios que tocan con este riego (abono…): se dan por hechos al regar
export function dueWithWatering(ctx, plant) {
  return (ctx.reminders || []).filter((r) => r.plant_id === plant.id && r.mode === 'with_watering' && reminderStatus(r, ctx.events).due);
}

export async function waterPlants(ctx, plants) {
  const created = [];
  const done = [];
  const adjusted = [];
  try {
    for (const p of plants) {
      const due = dueWithWatering(ctx, p);
      const learned = learnFromEarlyWatering(p, ctx.statuses?.[p.id]);
      created.push(await db.addEvent(p, 'water', ctx.user.id));
      if (learned) { await db.savePlant({ id: p.id, adjust: learned }).catch(() => {}); adjusted.push(p); }
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
        for (const p of adjusted) await db.savePlant({ id: p.id, adjust: p.adjust || 1 }).catch(() => {});
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

/** «Aún está húmeda»: pospone el riego unos días y aprende que esa planta se seca más despacio */
export async function stillWet(ctx, plant) {
  try {
    const st = ctx.statuses?.[plant.id];
    const ev = await db.addEvent(plant, 'check_wet', ctx.user.id);
    const learn = st?.lastWatered && !(plant.fixed_days > 0);
    if (learn) await db.savePlant({ id: plant.id, adjust: adjustAfterWetCheck(plant.adjust) });
    await ctx.reload();
    ctx.notify(`👍 Esperamos con ${plant.name}`, {
      label: 'Deshacer',
      run: async () => {
        await db.deleteEvent(ev);
        if (learn) await db.savePlant({ id: plant.id, adjust: plant.adjust || 1 });
        await ctx.reload();
      },
    });
  } catch (e) {
    ctx.notify(e.message);
  }
}
