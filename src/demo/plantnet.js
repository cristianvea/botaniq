// Identificación simulada para la demo: va rotando entre especies habituales.
export const plantnetEnabled = true;

const SETS = [
  [['Epipremnum aureum', 'Epipremnum', 'Araceae', 'Potos', 0.94], ['Philodendron hederaceum', 'Philodendron', 'Araceae', 'Filodendro trepador', 0.03]],
  [['Ficus lyrata', 'Ficus', 'Moraceae', 'Ficus lira', 0.88], ['Ficus elastica', 'Ficus', 'Moraceae', 'Árbol del caucho', 0.06]],
  [['Lavandula angustifolia', 'Lavandula', 'Lamiaceae', 'Lavanda', 0.42], ['Lavandula stoechas', 'Lavandula', 'Lamiaceae', 'Cantueso', 0.31], ['Salvia rosmarinus', 'Salvia', 'Lamiaceae', 'Romero', 0.08]],
  [['Dracaena trifasciata', 'Dracaena', 'Asparagaceae', 'Lengua de suegra', 0.91], ['Dracaena angolensis', 'Dracaena', 'Asparagaceae', 'Sansevieria cilíndrica', 0.04]],
  [['Phalaenopsis amabilis', 'Phalaenopsis', 'Orchidaceae', 'Orquídea mariposa', 0.86], ['Phalaenopsis aphrodite', 'Phalaenopsis', 'Orchidaceae', 'Orquídea', 0.07]],
  [['Echeveria elegans', 'Echeveria', 'Crassulaceae', 'Rosa de alabastro', 0.47], ['Graptopetalum paraguayense', 'Graptopetalum', 'Crassulaceae', 'Planta fantasma', 0.29]],
];
let n = 0;

export async function identifyPlant() {
  await new Promise((r) => setTimeout(r, 1300));
  const set = SETS[n++ % SETS.length];
  return set.map(([species, genus, family, commonName, score]) => ({ score, species, genus, family, commonName, commonNames: [commonName] }));
}
