import Dexie, { type Table } from "dexie";
import type { PantryItem, Recipe, Settings, HistoryEntry } from "./types";

export class MiseDB extends Dexie {
  recipes!: Table<Recipe, string>;
  settings!: Table<Settings, "singleton">;
  history!: Table<HistoryEntry, number>;
  pantry!: Table<PantryItem, string>;

  constructor() {
    super("mise_db");
    this.version(1).stores({
      recipes: "id, timeMin, costTier, active",
      settings: "id",
      history: "++id, recipeId, cookedAt",
      pantry: "nameKey",
    });
  }
}

export const db = new MiseDB();
