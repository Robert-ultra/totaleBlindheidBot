import { Bot } from 'node-telegram-bot-api';
import ScheduleDAO, { ScheduledRollcall } from './dao/ScheduleDAO.js';
import { executeRollcall } from './command/rollcall.js';
import { closeScheduleConfirmation } from './taggedMessages.js';
import RollcallReminder, { REMINDER_MS } from './RollcallReminder.js';

type Fire = (bot: Bot, chat_id: number, rsvp_id?: number) => Promise<unknown>;

const fireScheduledRollcall: Fire = (bot, chat_id, rsvp_id) =>
    executeRollcall(bot, { chat_id }, { rsvp_id }).then(() => closeScheduleConfirmation(bot, rsvp_id));

class RollcallScheduler {
    private readonly bot: Bot;
    private readonly scheduleDao: ScheduleDAO;
    private readonly fire: Fire;
    private readonly reminder: RollcallReminder;

    constructor(bot: Bot, scheduleDao: ScheduleDAO = new ScheduleDAO(), fire: Fire = fireScheduledRollcall, reminder: RollcallReminder = new RollcallReminder()) {
        this.bot = bot;
        this.scheduleDao = scheduleDao;
        this.fire = fire;
        this.reminder = reminder;
    }

    start(intervalMs: number): void {
        setInterval(() => {
            this.tick().catch((err: Error) => console.error('Error checking schedules:', err));
        }, intervalMs);
    }

    async tick(now: Date = new Date()): Promise<void> {
        const schedules = await this.scheduleDao.getScheduledRollcalls();
        await Promise.all(Object.entries(schedules)
            .map(([chat_id, schedule]) => schedule.time <= now
                ? this.run(Number(chat_id), schedule)
                : this.remindIfClose(Number(chat_id), schedule, now)));
    }

    private run(chat_id: number, schedule: ScheduledRollcall): Promise<void> {
        console.log(`Executing scheduled rollcall for chat ${chat_id}`);
        return this.fire(this.bot, chat_id, schedule.rsvp_id)
            .catch((err: Error) => console.error(`Error executing scheduled rollcall for ${chat_id}:`, err))
            .finally(() => this.scheduleDao.removeScheduledRollcall(chat_id))
            .then(() => undefined);
    }

    // Marked first so a failed or cancelling reminder isn't retried.
    private async remindIfClose(chat_id: number, schedule: ScheduledRollcall, now: Date): Promise<void> {
        if (!schedule.rsvp_id || schedule.reminded_at || schedule.time.getTime() - now.getTime() > REMINDER_MS) {
            return;
        }
        await this.scheduleDao.markReminded(chat_id)
            .then(() => this.reminder.remind(this.bot, chat_id, schedule, now))
            .catch((err: Error) => console.error(`Error reminding chat ${chat_id} of its rollcall:`, err));
    }
}

export default RollcallScheduler;
