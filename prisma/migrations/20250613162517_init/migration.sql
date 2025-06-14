-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "accessKey" TEXT NOT NULL,
    "telegramId" TEXT,
    "username" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "missedReminders" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_accessKey_key" ON "User"("accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
