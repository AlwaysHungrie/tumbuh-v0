/*
  Warnings:

  - You are about to drop the `Requests` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Requests" DROP CONSTRAINT "Requests_userId_fkey";

-- DropTable
DROP TABLE "Requests";

-- CreateTable
CREATE TABLE "Request" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "messageId" TEXT,
    "isResponded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
