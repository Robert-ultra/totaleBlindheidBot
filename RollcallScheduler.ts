import { Bot } from 'node-telegram-bot-api';
import ScheduleDAO, { ScheduledRollcall } from './dao/ScheduleDAO.js';
import { executeRollcall } from './command/rollcall.js';
import { CONFIRMATION_LEAD_MS, postScheduleConfirmation } from './command/schedule.js';
import { closeScheduleConfirmation } from './taggedMessages.js';
import { Recurrence } from './timeUtils.js';

type Fire = (bot: Bot, chat_id: number, rsvp_id?: number) => Promise<unknown>;
type Confirm = (bot: Bot, chat_id: number, time: Date, recurrence: Recurrence) => Promise<number>;

const fireScheduledRollcall: Fire = (bot, chat_id, rsvp_id) =>
    executeRollcall(bot, { chat_id }, { rsvp_id }).then(() => closeScheduleConfirmation(bot, rsvp_id));

const confirmOccurrence: Confirm = (bot, chat_id, time, recurrence) =>
    postScheduleConfirmation(bot, { chat_id }, time, recurrence.timezone, {}, recurrence);

class RollcallScheduler {
    private readonly bot: Bot;
    private readonly scheduleDao: ScheduleDAO;
    private readonly fire: Fire;
    private readonly confirm: Confirm;
    // A check can outlast the interval; this keeps the next one from acting on the same chat twice.
    private readonly busy: Set<number> = new Set();

    constructor(bot: Bot, scheduleDao: ScheduleDAO = new ScheduleDAO(), fire: Fire = fireScheduledRollcall, confirm: Confirm = confirmOccurrence) {
        this.bot = bot;
        this.scheduleDao = scheduleDao;
        this.fire = fire;
        this.confirm = confirm;
    }

    start(intervalMs: number): void {
        setInterval(() => {
            this.tick().catch((err: Error) => console.error('Error checking schedules:', err));
        }, intervalMs);
    }

    async tick(now: Date = new Date()): Promise<void> {
        const schedules = await this.scheduleDao.getScheduledRollcalls();
        await Promise.all(Object.entries(schedules)
            .filter(([chat_id]) => !this.busy.has(Number(chat_id)))
            .map(([chat_id, schedule]) => this.check(Number(chat_id), schedule, now)));
    }

    private async check(chat_id: number, schedule: ScheduledRollcall, now: Date): Promise<void> {
        const work: Promise<void> | undefined = schedule.time <= now
            ? this.run(chat_id, schedule, now)
            : this.confirmIfClose(chat_id, schedule, now);
        if (!work) {
            return;
        }
        this.busy.add(chat_id);
        await work.finally(() => this.busy.delete(chat_id));
    }

    private run(chat_id: number, schedule: ScheduledRollcall, now: Date): Promise<void> {
        console.log(`Executing scheduled rollcall for chat ${chat_id}`);
        return this.fire(this.bot, chat_id, schedule.rsvp_id)
            .catch((err: Error) => console.error(`Error executing scheduled rollcall for ${chat_id}:`, err))
            .finally(() => schedule.recurrence
                ? this.scheduleDao.updateScheduledRollcall(chat_id, schedule.recurrence.next(now))
                : this.scheduleDao.removeScheduledRollcall(chat_id))
            .then(() => undefined);
    }

    private confirmIfClose(chat_id: number, schedule: ScheduledRollcall, now: Date): Promise<void> | undefined {
        const recurrence: Recurrence | undefined = schedule.recurrence;
        if (!recurrence || schedule.rsvp_id || schedule.time.getTime() - now.getTime() > CONFIRMATION_LEAD_MS) {
            return undefined;
        }
        return this.confirm(this.bot, chat_id, schedule.time, recurrence)
            .then(rsvp_id => this.scheduleDao.updateScheduledRollcall(chat_id, schedule.time, rsvp_id));
    }
}

export default RollcallScheduler;
