/*
  Warnings:

  - Added the required column `updatedAt` to the `PantryItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN     "qty" DOUBLE PRECISION,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "alwaysHave" SET DEFAULT false;
