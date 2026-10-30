// Perfiles de cuidado. baseDays = días entre riegos en condiciones de referencia:
// interior, luz indirecta brillante, sustrato universal, maceta mediana de plástico, ~21 °C y 50 % HR.

export const PROFILES = {
  cactus: {
    label: 'Cactus', emoji: '🌵', baseDays: 28, defaultSubstrate: 'cactus',
    tip: 'Riega a fondo solo cuando el sustrato esté totalmente seco. En invierno, casi nada.',
  },
  suculenta: {
    label: 'Suculenta', emoji: '🪴', baseDays: 18, defaultSubstrate: 'cactus',
    tip: 'Deja secar por completo entre riegos. Si las hojas se arrugan, toca agua.',
  },
  resistente: {
    label: 'Resistente a la sequía (sansevieria, zamioculca…)', emoji: '🗡️', baseDays: 16, defaultSubstrate: 'universal',
    tip: 'Prefiere quedarse corta de agua. El exceso pudre los rizomas.',
  },
  tropical: {
    label: 'Tropical de interior (monstera, potos, filodendro…)', emoji: '🌿', baseDays: 6.5, defaultSubstrate: 'universal',
    tip: 'Riega cuando los 2–3 cm superiores estén secos.',
  },
  tropical_humeda: {
    label: 'Tropical de humedad alta (calathea, helecho, fitonia…)', emoji: '🌱', baseDays: 3.5, defaultSubstrate: 'universal',
    tip: 'Mantén el sustrato ligeramente húmedo, nunca encharcado. Agradece la humedad ambiental.',
  },
  ficus: {
    label: 'Ficus y arbustos de interior', emoji: '🌳', baseDays: 6.5, defaultSubstrate: 'universal',
    tip: 'Riega cuando la mitad superior del sustrato esté seca. No le gustan los cambios de sitio.',
  },
  palmera: {
    label: 'Palmera', emoji: '🌴', baseDays: 6.5, defaultSubstrate: 'universal',
    tip: 'Riego regular sin encharcar. Puntas marrones = aire seco o agua con mucha cal.',
  },
  orquidea: {
    label: 'Orquídea (phalaenopsis y similares)', emoji: '🌸', baseDays: 10.5, defaultSubstrate: 'corteza',
    tip: 'Riega por inmersión 10 min cuando las raíces estén plateadas; escurre bien.',
  },
  flor_interior: {
    label: 'Flor de interior de invierno (flor de pascua, ciclamen…)', emoji: '❤️', baseDays: 2.4, defaultSubstrate: 'universal',
    tip: 'Riega cuando los 2 cm de arriba estén secos y vacía siempre el plato: se pudre con facilidad. Lejos de radiadores y corrientes.',
  },
  floracion: {
    label: 'Planta de flor de temporada', emoji: '🌺', baseDays: 3, defaultSubstrate: 'universal',
    tip: 'En floración consume mucha agua. Evita mojar flores y hojas.',
  },
  geranio: {
    label: 'Geranio / gitanilla', emoji: '🌺', baseDays: 5, defaultSubstrate: 'universal',
    tip: 'Tolera algo de sequía; mejor quedarse corto que pasarse.',
  },
  aromatica_lenosa: {
    label: 'Mediterránea leñosa (romero, lavanda, tomillo, olivo…)', emoji: '🫒', baseDays: 7, defaultSubstrate: 'universal',
    tip: 'Muy tolerante a la sequía. Odia el encharcamiento.',
  },
  aromatica_blanda: {
    label: 'Hierba de hoja blanda (albahaca, menta, perejil…)', emoji: '🌿', baseDays: 3, defaultSubstrate: 'universal',
    tip: 'Le gusta el sustrato siempre algo húmedo. En verano puede necesitar agua a diario.',
  },
  huerto: {
    label: 'Huerto (tomate, pimiento, fresa…)', emoji: '🍅', baseDays: 2.5, defaultSubstrate: 'universal',
    tip: 'Riego regular y constante; las irregularidades agrietan los frutos.',
  },
  arbusto_exterior: {
    label: 'Arbusto o trepadora de exterior', emoji: '🌳', baseDays: 6, defaultSubstrate: 'universal',
    tip: 'En maceta se seca mucho más que en suelo. Riega a fondo.',
  },
  hortensia: {
    label: 'Acidófila (brezo, hortensia, azalea, camelia…)', emoji: '💠', baseDays: 2.7, defaultSubstrate: 'acida',
    tip: 'Usa agua sin cal (de lluvia o reposada). Le gusta el sustrato fresco.',
  },
  carnivora: {
    label: 'Carnívora', emoji: '🪰', baseDays: 2, defaultSubstrate: 'turba',
    tip: 'Siempre húmeda, con agua destilada o de lluvia. Riego por bandeja.',
  },
  tillandsia: {
    label: 'Tillandsia (planta aérea)', emoji: '🌬️', baseDays: 6, defaultSubstrate: 'ninguno',
    tip: 'Sumérgela 20–30 min y déjala secar boca abajo.',
  },
  bonsai: {
    label: 'Bonsái', emoji: '🎍', baseDays: 2.5, defaultSubstrate: 'cactus',
    tip: 'Poco sustrato: revisa a menudo. Nunca dejes que se seque del todo.',
  },
  generica: {
    label: 'Genérica / no lo sé', emoji: '🪴', baseDays: 5.8, defaultSubstrate: 'universal',
    tip: 'Riega cuando los primeros centímetros estén secos al tacto.',
  },
};

// Sustratos y cuánto aceleran (>1) o frenan (<1) el secado.
export const SUBSTRATES = {
  unknown:   { label: 'No lo sé (el que traía de la tienda)', factor: null },
  universal: { label: 'Universal / turba con perlita', factor: 1 },
  cactus:    { label: 'Cactus o mineral (arena, pómice, akadama)', factor: 1.25 },
  corteza:   { label: 'Corteza de pino (orquídeas)', factor: 1.25 },
  turba:     { label: 'Turba rubia / esfagno', factor: 0.8 },
  acida:     { label: 'Sustrato para acidófilas', factor: 0.9 },
  coco:      { label: 'Fibra de coco', factor: 1.1 },
  tierra:    { label: 'Tierra de jardín', factor: 0.85 },
  ninguno:   { label: 'Sin sustrato', factor: 1 },
};

export const LIGHTS = {
  direct:   { label: 'Sol directo', factor: 1.2, outdoorFactor: 1 },
  indirect: { label: 'Luz indirecta brillante', factor: 1, outdoorFactor: 0.75 },
  low:      { label: 'Poca luz / sombra', factor: 0.85, outdoorFactor: 0.6 },
};

export const POTS = {
  small:  { label: 'Pequeña (< 12 cm)', factor: 1.25 },
  medium: { label: 'Mediana (12–25 cm)', factor: 1 },
  large:  { label: 'Grande (> 25 cm)', factor: 0.85 },
};

export const POT_MATERIALS = {
  plastic:    { label: 'Plástico / cerámica esmaltada', factor: 1 },
  terracotta: { label: 'Barro / terracota', factor: 1.2 },
};

export function substrateFor(plant) {
  if (!plant.substrate || plant.substrate === 'unknown') {
    return (PROFILES[plant.profile] || PROFILES.generica).defaultSubstrate;
  }
  return plant.substrate;
}

// ───────── Mapeo de lo que devuelve Pl@ntNet a un perfil ─────────

const GENUS = {
  cactus: ['Opuntia','Mammillaria','Echinocactus','Echinopsis','Cereus','Ferocactus','Gymnocalycium','Astrophytum','Rebutia','Parodia','Cleistocactus','Espostoa','Pilosocereus','Schlumbergera','Rhipsalis','Epiphyllum','Hylocereus','Selenicereus','Stenocereus','Trichocereus','Notocactus','Lophophora','Cephalocereus','Myrtillocactus','Disocactus','Hatiora'],
  suculenta: ['Echeveria','Crassula','Sedum','Aloe','Haworthia','Haworthiopsis','Gasteria','Kalanchoe','Graptopetalum','Graptoveria','Pachyphytum','Sempervivum','Aeonium','Agave','Senecio','Curio','Lithops','Euphorbia','Adenium','Portulacaria','Portulaca','Cotyledon','Delosperma','Aptenia','Carpobrotus','Dudleya','Ceropegia','Stapelia','Huernia','Hoya','Peperomia','Pachypodium'],
  resistente: ['Sansevieria','Dracaena','Zamioculcas','Aspidistra','Clivia','Yucca','Beaucarnea'],
  tropical: ['Monstera','Philodendron','Epipremnum','Scindapsus','Syngonium','Anthurium','Spathiphyllum','Aglaonema','Dieffenbachia','Alocasia','Colocasia','Caladium','Schefflera','Heptapleurum','Chlorophytum','Tradescantia','Pilea','Begonia','Hedera','Rhaphidophora','Cissus','Codiaeum','Cordyline','Dypsis','Strelitzia','Musa','Zebrina','Ctenanthe','Pothos','Rhipsalidopsis','Saintpaulia','Streptocarpus','Fatsia','Plectranthus','Coleus','Hypoestes','Polyscias','Radermachera'],
  tropical_humeda: ['Calathea','Goeppertia','Maranta','Stromanthe','Fittonia','Nephrolepis','Adiantum','Asplenium','Platycerium','Pteris','Davallia','Phlebodium','Polypodium','Selaginella','Soleirolia','Peperomia_','Pellionia','Episcia','Guzmania','Vriesea','Aechmea','Neoregelia','Bromelia','Cryptanthus','Ananas'],
  ficus: ['Ficus','Pachira','Crassula_','Ardisia','Citrus','Coffea','Laurus','Ligustrum','Murraya','Gardenia'],
  palmera: ['Chamaedorea','Howea','Kentia','Phoenix','Rhapis','Livistona','Trachycarpus','Washingtonia','Chamaerops','Cycas','Areca','Caryota','Ravenea','Archontophoenix','Butia','Syagrus','Zamia'],
  orquidea: ['Phalaenopsis','Dendrobium','Oncidium','Cattleya','Cymbidium','Vanda','Paphiopedilum','Miltonia','Miltoniopsis','Zygopetalum','Cambria','Ludisia','Masdevallia','Epidendrum','Brassia'],
  floracion: ['Petunia','Impatiens','Primula','Cyclamen_','Viola','Calibrachoa','Begonia_','Tagetes','Zinnia','Dahlia','Gerbera','Chrysanthemum','Osteospermum','Dimorphotheca','Lobelia','Salvia_','Fuchsia','Verbena','Celosia','Euphorbia_','Calceolaria','Sinningia','Hippeastrum','Tulipa','Narcissus','Hyacinthus','Anemone','Ranunculus','Bacopa','Sutera','Lantana','Mandevilla','Dipladenia','Torenia','Cuphea','Catharanthus','Antirrhinum','Dianthus','Campanula','Kalanchoe_','Spathiphyllum_','Bellis','Ageratum','Cosmos','Helianthus','Tropaeolum'],
  geranio: ['Pelargonium','Geranium'],
  aromatica_lenosa: ['Rosmarinus','Salvia','Lavandula','Thymus','Olea','Bougainvillea','Nerium','Myrtus','Santolina','Helichrysum','Cistus','Teucrium','Origanum','Satureja','Callistemon','Pistacia','Westringia','Phlomis','Euryops','Leucophyllum','Polygala','Plumbago','Jasminum','Trachelospermum','Punica','Ceratonia','Pittosporum','Viburnum','Arbutus','Lagerstroemia'],
  aromatica_blanda: ['Ocimum','Mentha','Petroselinum','Coriandrum','Anethum','Melissa','Allium','Rumex','Eruca','Lactuca','Spinacia','Cymbopogon','Stevia','Aloysia','Tropaeolum_'],
  huerto: ['Solanum','Capsicum','Fragaria','Cucumis','Cucurbita','Phaseolus','Pisum','Brassica','Beta','Daucus','Citrullus','Physalis','Rubus','Vaccinium_'],
  arbusto_exterior: ['Rosa','Hibiscus','Buxus','Abelia','Photinia','Euonymus','Lonicera','Wisteria','Clematis','Parthenocissus','Ipomoea','Passiflora','Solanum_','Thunbergia','Hebe','Spiraea','Weigela','Forsythia','Syringa','Philadelphus','Cotoneaster','Pyracantha','Juniperus','Thuja','Cupressus','Taxus','Acer','Prunus','Malus','Lagunaria','Bambusa','Phyllostachys','Fargesia','Carex','Festuca','Pennisetum','Miscanthus','Stipa','Agapanthus','Hemerocallis','Iris','Lilium'],
  hortensia: ['Hydrangea','Rhododendron','Azalea','Camellia','Gardenia_','Pieris','Skimmia','Vaccinium','Erica','Calluna','Pieris_','Ilex'],
  carnivora: ['Dionaea','Drosera','Sarracenia','Nepenthes','Pinguicula','Utricularia','Cephalotus','Darlingtonia'],
  tillandsia: ['Tillandsia'],
};

const FAMILY = {
  Cactaceae: 'cactus',
  Crassulaceae: 'suculenta',
  Aizoaceae: 'suculenta',
  Asphodelaceae: 'suculenta',
  Araceae: 'tropical',
  Marantaceae: 'tropical_humeda',
  Polypodiaceae: 'tropical_humeda',
  Pteridaceae: 'tropical_humeda',
  Aspleniaceae: 'tropical_humeda',
  Nephrolepidaceae: 'tropical_humeda',
  Dryopteridaceae: 'tropical_humeda',
  Bromeliaceae: 'tropical_humeda',
  Arecaceae: 'palmera',
  Orchidaceae: 'orquidea',
  Moraceae: 'ficus',
  Lamiaceae: 'aromatica_lenosa',
  Geraniaceae: 'geranio',
  Ericaceae: 'hortensia',
  Hydrangeaceae: 'hortensia',
  Droseraceae: 'carnivora',
  Sarraceniaceae: 'carnivora',
  Nepenthaceae: 'carnivora',
  Solanaceae: 'huerto',
  Cucurbitaceae: 'huerto',
  Rosaceae: 'arbusto_exterior',
  Asteraceae: 'floracion',
  Begoniaceae: 'tropical',
  Gesneriaceae: 'tropical',
  Apocynaceae: 'arbusto_exterior',
  Oleaceae: 'aromatica_lenosa',
  Myrtaceae: 'aromatica_lenosa',
  Poaceae: 'arbusto_exterior',
  Strelitziaceae: 'tropical',
  Musaceae: 'tropical',
  Euphorbiaceae: 'suculenta',
};

const GENUS_INDEX = {};
for (const [profile, list] of Object.entries(GENUS)) {
  for (const g of list) {
    if (g.endsWith('_')) continue; // duplicados marcados para no sobrescribir
    if (!GENUS_INDEX[g]) GENUS_INDEX[g] = profile;
  }
}

// Especies que no siguen a su género (p. ej. la flor de pascua es una Euphorbia, pero no es una crasa)
const SPECIES = {
  'Euphorbia pulcherrima': 'flor_interior',
  'Cyclamen persicum': 'flor_interior',
  'Rhododendron simsii': 'hortensia',
  'Kalanchoe blossfeldiana': 'suculenta',
};

export function profileForTaxon({ species, genus, family }) {
  const sp = (species || '').split(' ').slice(0, 2).join(' ');
  if (SPECIES[sp]) return SPECIES[sp];
  if (genus && GENUS_INDEX[genus]) return GENUS_INDEX[genus];
  if (family && FAMILY[family]) return FAMILY[family];
  return 'generica';
}

// Sugerencia de ubicación típica por perfil (solo como valor inicial).
export function suggestedPlacement(profile) {
  const outdoor = ['aromatica_lenosa', 'aromatica_blanda', 'huerto', 'arbusto_exterior', 'geranio', 'hortensia'];
  if (outdoor.includes(profile)) return { location: 'outdoor', light: 'direct' };
  if (profile === 'cactus' || profile === 'suculenta') return { location: 'indoor', light: 'direct' };
  if (profile === 'resistente') return { location: 'indoor', light: 'low' };
  return { location: 'indoor', light: 'indirect' };
}
