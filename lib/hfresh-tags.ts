/**
 * Tag normalization and ingredient-based recipe classification.
 */

import type { Ingredient } from "./types";

// ── hfresh tag name -> internal slug ──

const HFRESH_TAG_MAP: Record<string, string> = {
  "Vegano": "vegan",
  "Vegetariano": "vegetarian",
  "Pescetariano": "pescatarian",
  "Exprés": "quick",
  "Familia": "family",
  "Proteico": "high-protein",
  "Bajo en calorías": "low-calorie",
  "Premium": "premium",
  "Una olla": "one-pot",
  "Una sartén": "one-pan",
  "Solo horno": "oven-only",
  "Picante": "spicy",
  "Street food": "street-food",
  "Regional": "regional",
  "Preparación en 10'": "quick",
  "Preparación en 15'": "quick",
  "Rápido": "quick",
  "<50g carbohidratos": "low-carb",
  "Novedad": "new",
  "Lunch": "lunch",
  "Dinner": "dinner",
};

export function normalizeHfreshTags(tagNames: string[]): string[] {
  const result: string[] = [];
  for (const name of tagNames) {
    const slug = HFRESH_TAG_MAP[name];
    if (slug && !result.includes(slug)) result.push(slug);
  }
  return result;
}

// ── Ingredient-based classification ──

type Rule = { pattern: RegExp; tag: string };

const MEAT_PATTERNS = /\b(pollo|pollastre|ternera|vedella|cerdo|porc|cordero|xai|pavo|gall dindi|chorizo|salchicha|salsitxa|jamón|pernil|bacon|panceta|carne|hamburguesa)\b/i;
const FISH_PATTERNS = /\b(salmón|salmó|atún|tonyina|bacalao|bacallà|gambas|gambes|merluza|lluç|pescado|peix|langostino|langostí|mejillones|musclos|calamar|pulpo|pop|anchoa|anxova|sepia)\b/i;
const DAIRY_PATTERNS = /\b(leche|llet|queso|formatge|nata|crema|yogur|iogurt|mantequilla|mantega|mozzarella|parmesano|parmesan|ricotta|crème fraîche|cheddar|gouda|feta|mascarpone)\b/i;
const EGG_PATTERN = /\b(huevo|ou|huevos|ous)\b/i;

const CUISINE_RULES: Rule[] = [
  // Japanese
  { pattern: /\b(sushi|nori|wasabi|miso|teriyaki|sake|mirin|dashi|edamame|udon|ramen|soba|katsu|tempura)\b/i, tag: "japanese" },
  // Thai
  { pattern: /\b(thai|pad thai|curry.*thai|lemongrass|hierba limón|galangal|nam pla|salsa.*pescado|leche.*coco.*curry)\b/i, tag: "thai" },
  // Chinese
  { pattern: /\b(chino|china|wok|hoisin|five.?spice|dim.?sum|chow.?mein|szechuan|sichuan|tofu.*soja)\b/i, tag: "chinese" },
  // Korean
  { pattern: /\b(korean|coreano|gochujang|kimchi|bibimbap|bulgogi|tteokbokki)\b/i, tag: "korean" },
  // Indian
  { pattern: /\b(curry(?!.*thai)|cúrcuma|curcuma|garam.?masala|tandoori|naan|paneer|tikka|masala|dal|dhal)\b/i, tag: "indian" },
  // Mexican
  { pattern: /\b(mexicano|taco|burrito|quesadilla|enchilada|jalapeño|jalapeno|chipotle|guacamole|tortilla.*maíz|nachos|fajita)\b/i, tag: "mexican" },
  // Italian
  { pattern: /\b(italiano|italiana|pasta|espagueti|spaghetti|penne|rigatoni|lasaña|lasagna|risotto|pesto|carbonara|aglio|bolognese|boloñesa|gnocchi|ravioli|focaccia)\b/i, tag: "italian" },
  // Mediterranean
  { pattern: /\b(mediterráneo|mediterraneo|feta|hummus|couscous|cuscús|tabulé|falafel|pita|tzatziki|aceitunas|olivas)\b/i, tag: "mediterranean" },
  // Spanish
  { pattern: /\b(español|española|tortilla.*española|paella|gazpacho|pimentón|pimentó|chorizo.*patata)\b/i, tag: "spanish" },
  // Asian (general)
  { pattern: /\b(soja|salsa.*soja|jengibre|gingebre|sésamo|sèsam|sriracha|sambal|wonton|gyoza|spring.?roll)\b/i, tag: "asian" },
];

function getAllIngredientText(ingredients: Ingredient[]): string {
  return ingredients
    .map((i) => `${i.name?.es || ""} ${i.name?.ca || ""}`)
    .join(" ");
}

export function classifyByIngredients(ingredients: Ingredient[]): string[] {
  const text = getAllIngredientText(ingredients);
  const tags: string[] = [];

  const hasMeat = MEAT_PATTERNS.test(text);
  const hasFish = FISH_PATTERNS.test(text);
  const hasDairy = DAIRY_PATTERNS.test(text);
  const hasEgg = EGG_PATTERN.test(text);

  // Diet tags
  if (!hasMeat && !hasFish) {
    if (!hasDairy && !hasEgg) tags.push("vegan");
    else tags.push("vegetarian");
  }
  if (hasFish && !hasMeat) tags.push("pescatarian");
  if (hasMeat || hasFish) tags.push("high-protein");

  // Cuisine tags
  for (const rule of CUISINE_RULES) {
    if (rule.pattern.test(text) && !tags.includes(rule.tag)) {
      tags.push(rule.tag);
    }
  }

  return tags;
}

export function classifyByTitle(title: Record<string, string>): string[] {
  const text = `${title.es || ""} ${title.ca || ""}`;
  const tags: string[] = [];

  for (const rule of CUISINE_RULES) {
    if (rule.pattern.test(text) && !tags.includes(rule.tag)) {
      tags.push(rule.tag);
    }
  }

  return tags;
}

export function mergeTags(existing: string[], ...newSets: string[][]): string[] {
  const merged = new Set(existing);
  for (const set of newSets) {
    for (const tag of set) merged.add(tag);
  }
  return Array.from(merged);
}
