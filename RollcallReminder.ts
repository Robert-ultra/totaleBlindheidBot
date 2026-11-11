import { Bot } from 'node-telegram-bot-api';
import RsvpDAO, { RsvpList } from './dao/RsvpDAO.js';
import RollcallPlayerDAO from './dao/RollcallPlayerDAO.js';
import ChatDAO from './dao/ChatDAO.js';
import { ScheduledRollcall } from './dao/ScheduleDAO.js';
import { LOBBY_SIZE, resolve } from './rsvp.js';
import { cancelScheduledRollcall } from './command/cancel.js';
import { pingTags } from './ping.js';

export const REMINDER_MS: number = (Number(process.env.REMINDER_MINUTES) || 15) * 60 * 1000;

type Cancel = (bot: Bot, chat_id: number, schedule: ScheduledRollcall, text: string) => Promise<unknown>;
type Ping = (bot: Bot, chat_id: number, text: string, tags: string[]) => Promise<unknown>;

const cancelRollcall: Cancel = (bot, chat_id, schedule, text) => cancelScheduledRollcall(bot, { chat_id }, schedule, text);

// Shortly before a scheduled rollcall: chases whoever hasn't committed, or calls it off when
// the chat has auto-cancel on and too few said yes.
class RollcallReminder {
    private readonly rsvpDao: RsvpDAO;
    private readonly rosterDao: RollcallPlayerDAO;
    private readonly chatDao: ChatDAO;
    private readonly cancel: Cancel;
    private readonly ping: Ping;

    constructor(rsvpDao: RsvpDAO = new RsvpDAO(), rosterDao: RollcallPlayerDAO = new RollcallPlayerDAO(), chatDao: ChatDAO = new ChatDAO(),
        cancel: Cancel = cancelRollcall, ping: Ping = pingTags) {
        this.rsvpDao = rsvpDao;
        this.rosterDao = rosterDao;
        this.chatDao = chatDao;
        this.cancel = cancel;
        this.ping = ping;
    }

    async remind(bot: Bot, chat_id: number, schedule: ScheduledRollcall, now: Date): Promise<void> {
        const list: RsvpList | undefined = schedule.rsvp_id ? await this.rsvpDao.getRsvpList(schedule.rsvp_id) : undefined;
        // A confirmation posted this close to the rollcall has only just tagged everyone.
        if (!list || schedule.time.getTime() - list.created_at.getTime() <= REMINDER_MS) {
            return;
        }
        const yes: number = Object.values(list.entries).filter(entry => entry.rsvp === 'yes').length;
        if (yes < LOBBY_SIZE && await this.chatDao.isAutoCancel(chat_id)) {
            await this.cancel(bot, chat_id, schedule, `Rollcall cancelled: only ${yes} of ${LOBBY_SIZE} said yes.`);
            return;
        }
        const { pending } = resolve(await this.rosterDao.getRollcallPlayerUsernames(chat_id), list.entries);
        if (pending.length > 0) {
            const minutes: number = Math.round((schedule.time.getTime() - now.getTime()) / 60000);
            await this.ping(bot, chat_id, `Rollcall in ${minutes} minutes! Still waiting on: `, pending);
        }
    }
}

export default RollcallReminder;
