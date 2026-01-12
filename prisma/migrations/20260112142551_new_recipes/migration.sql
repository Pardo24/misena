/*
  Warnings:

  - You are about to drop the column `dataJson` on the `Recipe` table. All the data in the column will be lost.
  - You are about to drop the column `titleCa` on the `Recipe` table. All the data in the column will be lost.
  - You are about to drop the column `titleEs` on the `Recipe` table. All the data in the column will be lost.
  - Added the required column `costTier` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difficulty` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredients` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mealType` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `steps` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tags` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timeMin` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Recipe` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "dataJson",
DROP COLUMN "titleCa",
DROP COLUMN "titleEs",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "costTier" INTEGER NOT NULL,
ADD COLUMN     "description" JSONB NOT NULL,
ADD COLUMN     "difficulty" TEXT NOT NULL,
ADD COLUMN     "ingredients" JSONB NOT NULL,
ADD COLUMN     "mealType" TEXT NOT NULL,
ADD COLUMN     "steps" JSONB NOT NULL,
ADD COLUMN     "tags" JSONB NOT NULL,
ADD COLUMN     "timeMin" INTEGER NOT NULL,
ADD COLUMN     "title" JSONB NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
