import type { Recipe, Settings } from "./types";

export const defaultSettings: Settings = {
  id: "singleton",
  lang: "es",
  mode: "lazy",
  doublePortions: true,
  householdSize: 2,
  maxTimeMin: 25,
  maxCostTier: 2,
  noRepeatDays: 12,
};

export const seedRecipes: Recipe[] = [
  {
    id: "pasta_atun_tomate",
    title: { es: "Pasta rápida con atún y tomate", ca: "Pasta ràpida amb tonyina i tomàquet" },
    description: { es: "Rápida, barata y con proteína. Ideal para sobras.", ca: "Ràpida, econòmica i amb proteïna. Ideal per a sobres." },
    timeMin: 15,
    costTier: 1,
    difficulty: "easy",
    tags: ["quick", "budget", "one-pot"],
    active: 1,
    ingredients: [
      { name: { es: "Pasta", ca: "Pasta" }, qty: 200, unit: "g", category: "secos" },
      { name: { es: "Atún en lata", ca: "Tonyina en llauna" }, qty: 2, unit: "u", category: "conservas" },
      { name: { es: "Tomate triturado", ca: "Tomàquet triturat" }, qty: 250, unit: "g", category: "conservas" },
      { name: { es: "Ajo", ca: "All" }, qty: 2, unit: "diente", category: "verduras", pantry: true },
      { name: { es: "Aceite de oliva", ca: "Oli d'oliva" }, qty: 1, unit: "cda", category: "despensa", pantry: true },
    ],
    steps: {
      es: ["Cuece la pasta.", "Sofríe ajo, añade tomate y atún.", "Mezcla con la pasta y ajusta sal."],
      ca: ["Bull la pasta.", "Salteja l’all, afegeix tomàquet i tonyina.", "Barreja amb la pasta i ajusta la sal."],
    },
  },
  {
    id: "wok_verduras_huevo",
    title: { es: "Wok de verduras con huevo", ca: "Wok de verdures amb ou" },
    description: { es: "Ultrarrápida con verduras congeladas.", ca: "Ultraràpida amb verdures congelades." },
    timeMin: 12,
    costTier: 1,
    difficulty: "easy",
    tags: ["quick", "budget", "one-pan"],
    active: 1,
    ingredients: [
      { name: { es: "Verduras congeladas para saltear", ca: "Verdures congelades per saltar" }, qty: 400, unit: "g", category: "verduras" },
      { name: { es: "Huevos", ca: "Ous" }, qty: 4, unit: "u", category: "lacteos" },
      { name: { es: "Salsa de soja", ca: "Salsa de soja" }, qty: 1, unit: "cda", category: "despensa", pantry: true },
      { name: { es: "Aceite de oliva", ca: "Oli d'oliva" }, qty: 1, unit: "cda", category: "despensa", pantry: true },
    ],
    steps: {
      es: ["Saltea las verduras a fuego fuerte.", "Añade los huevos y revuelve.", "Termina con salsa de soja."],
      ca: ["Salteja les verdures a foc fort.", "Afegeix els ous i remena.", "Acaba amb salsa de soja."],
    },
  },
];
