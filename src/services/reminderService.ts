// import TelegramBot from 'node-telegram-bot-api';
// import { userService } from './userService';

// const reminderIntervals = new Map<number, NodeJS.Timeout>();

// export const reminderService = {
//   startReminders(bot: TelegramBot, user: { id: number; telegramId: string | null }) {
//     if (!user.telegramId) {
//       return;
//     }

//     if (reminderIntervals.has(user.id)) {
//       clearInterval(reminderIntervals.get(user.id));
//     }

//     const interval = setInterval(async () => {
//       const updatedUser = await userService.findUserByTelegramId(user.telegramId);

//       if (!updatedUser || !updatedUser.isActive) {
//         clearInterval(interval);
//         reminderIntervals.delete(user.id);
//         return;
//       }

//       bot.sendMessage(user.telegramId, 'Reminder: Please respond to this message!')
//         .then(async () => {
//           await userService.updateLastReminder(user.id);
//         })
//         .catch(async () => {
//           const updatedUser = await userService.incrementMissedReminders(user.id);

//           if (updatedUser.missedReminders >= 2) {
//             await userService.deactivateUser(user.id);
//             bot.sendMessage(user.telegramId, 'You have missed too many reminders. Your account has been deactivated. Please contact an admin to reset it.');
//             clearInterval(interval);
//             reminderIntervals.delete(user.id);
//           }
//         });
//     }, 30000); // 30 seconds

//     reminderIntervals.set(user.id, interval);
//   },

//   stopReminders(userId: number) {
//     if (reminderIntervals.has(userId)) {
//       clearInterval(reminderIntervals.get(userId));
//       reminderIntervals.delete(userId);
//     }
//   }
// }; 