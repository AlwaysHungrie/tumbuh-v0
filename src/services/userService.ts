import { prisma } from '../prisma'

export const userService = {
  async createUser(
    accessKey: string,
    username: string,
    initialInvestmentAmount: number,
    address: string,
    privateKey: string
  ) {
    return prisma.user.create({
      data: {
        accessKey,
        username,
        initialInvestmentAmount,
        walletAddress: address,
        walletPrivateKey: privateKey,
      },
    })
  },

  async resetUser(id: number) {
    return prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        lastReminderAt: new Date(),
        missedReminders: 0,
      },
    })
  },

  async addTelegramId(accessKey: string, telegramId: string) {
    return prisma.user.update({
      where: { accessKey },
      data: { telegramId },
    })
  },

  async findUserByAccessKey(accessKey: string) {
    return prisma.user.findUnique({
      where: { accessKey },
    })
  },

  async findUserByUsername(username: string) {
    return prisma.user.findFirst({
      where: { username },
    })
  },

  async findUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
    })
  },

  async updateLastReminder(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastReminderAt: new Date() },
    })
  },

  async incrementMissedReminders(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        missedReminders: { increment: 1 },
      },
    })
  },

  async deactivateUser(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    })
  },
}
