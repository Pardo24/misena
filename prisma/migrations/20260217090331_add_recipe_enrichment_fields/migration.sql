-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "allergens" JSONB,
ADD COLUMN     "nutrition" JSONB,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "stepImages" JSONB;
