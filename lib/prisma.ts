import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const filePath = url.replace(/^file:/, ""); // "file:./x.db" -> "./x.db"

const adapter = new PrismaBetterSqlite3({
  client: new Database(filePath),
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
