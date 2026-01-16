import Dexie, { type Table } from "dexie";
import type { PantryItem, Recipe, Settings, HistoryEntry, LocalQueueItem } from "./types";
import { QueueItem } from "@prisma/client";

export class MiseDB extends Dexie {
  recipes!: Table<Recipe, string>;
  settings!: Table<Settings, "singleton">;
  history!: Table<HistoryEntry, number>;
  pantry!: Table<PantryItem, string>;
  queue!: Table<LocalQueueItem, string>;

  constructor() {
    super("mise_db");
    this.version(1).stores({
      recipes: "id, timeMin, costTier, active",
      settings: "id",
      history: "++id, recipeId, cookedAt",
      pantry: "nameKey",
      queue: "recipeId, position, createdAt"
    });
  }
}

export const db = new MiseDB();
