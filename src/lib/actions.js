import * as db from './data.js';

export async function waterPlants(ctx, plants) {
  const created = [];
  try {
    for (const p of plants) created.push(await db.addEvent(p, 'water', ctx.user.id));
    await ctx.reload();
    const text = plants.length === 1 ? `💧 ${plants[0].name} regada` : `💧 ${plants.length} plantas regadas`;
    ctx.notify(text, {
      label: 'Deshacer',
      run: async () => { for (const e of created) await db.deleteEvent(e); await ctx.reload(); },
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
