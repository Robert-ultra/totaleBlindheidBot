import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import ScheduleDAO, { ScheduledRollcall, ScheduledRollcalls } from '../dao/ScheduleDAO.js';
import { formatError } from '../utils.js';
import { retireRsvpList } from '../taggedMessages.js';
import { broadcast, Target } from '../messenger.js';
import { asFormatted } from '../format.js';

const scheduleDao = new ScheduleDAO();

export const cancelScheduledRollcall = (bot: Bot, target: Target, schedule: ScheduledRollcall, text: string): Promise<unknown> =>
    scheduleDao.removeScheduledRollcall(target.chat_id)
        .then(() => schedule.rsvp_id ? retireRsvpList(bot, schedule.rsvp_id) : undefined)
        .then(() => broadcast(bot, target, asFormatted(text), text));

export default (bot: Bot, cmd: Command): Promise<unknown> => {
    const chat_id: number = cmd.chat_id;
    return scheduleDao.getScheduledRollcalls()
        .then((schedules: ScheduledRollcalls) => {
            if (schedules[chat_id]) {
                return cancelScheduledRollcall(bot, cmd, schedules[chat_id], 'Scheduled rollcall cancelled.');
            }

            return cmd.reply('No rollcall scheduled for this group.');
        })
        .catch((err: Error) => cmd.reply(formatError(err)));
};
