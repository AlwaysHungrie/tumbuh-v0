-- AlterTable
ALTER TABLE "User" ADD COLUMN     "initialInvestmentAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profitEarned" TEXT NOT NULL DEFAULT '0',
ALTER COLUMN "isActive" SET DEFAULT false;
