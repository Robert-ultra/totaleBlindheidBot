import { Bot } from 'node-telegram-bot-api';
import ScheduleDAO, { ScheduledRollcall } from './dao/ScheduleDAO.js';
import { executeRollcall } from './command/rollcall.js';
import { closeScheduleConfirmation } from './taggedMessages.js';

type Fire = (bot: Bot, chat_id: number, rsvp_id?: number) => Promise<unknown>;

const fireScheduledRollcall: Fire = (bot, chat_id, rsvp_id) =>
    executeRollcall(bot, { chat_id }, { rsvp_id }).then(() => closeScheduleConfirmation(bot, rsvp_id));

class RollcallScheduler {
    private readonly bot: Bot;
    private readonly scheduleDao: ScheduleDAO;
    private readonly fire: Fire;

    constructor(bot: Bot, scheduleDao: ScheduleDAO = new ScheduleDAO(), fire: Fire = fireScheduledRollcall) {
        this.bot = bot;
        this.scheduleDao = scheduleDao;
        this.fire = fire;
    }

    start(intervalMs: number): void {
        setInterval(() => {
            this.tick().catch((err: Error) => console.error('Error checking schedules:', err));
        }, intervalMs);
    }

    async tick(now: Date = new Date()): Promise<void> {
        const schedules = await this.scheduleDao.getScheduledRollcalls();
        await Promise.all(Object.entries(schedules)
            .filter(([, schedule]) => schedule.time <= now)
            .map(([chat_id, schedule]) => this.run(Number(chat_id), schedule)));
    }

    private run(chat_id: number, schedule: ScheduledRollcall): Promise<void> {
        console.log(`Executing scheduled rollcall for chat ${chat_id}`);
        return this.fire(this.bot, chat_id, schedule.rsvp_id)
            .catch((err: Error) => console.error(`Error executing scheduled rollcall for ${chat_id}:`, err))
            .finally(() => this.scheduleDao.removeScheduledRollcall(chat_id))
            .then(() => undefined);
    }
}

export default RollcallScheduler;
