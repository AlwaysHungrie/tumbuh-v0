/*
  Warnings:

  - A unique constraint covering the columns `[walletAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[walletPrivateKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profitCommitted" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "walletAddress" TEXT,
ADD COLUMN     "walletPrivateKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletPrivateKey_key" ON "User"("walletPrivateKey");
