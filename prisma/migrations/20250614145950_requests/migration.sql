-- CreateTable
CREATE TABLE "Requests" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "messageId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "isReplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Requests_messageId_key" ON "Requests"("messageId");

-- AddForeignKey
ALTER TABLE "Requests" ADD CONSTRAINT "Requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
