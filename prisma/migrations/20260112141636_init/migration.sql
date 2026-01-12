-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "titleEs" TEXT NOT NULL,
    "titleCa" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);
