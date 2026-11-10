import { Bot, CallbackQuery, Message } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../../MessageRouter.js';
import UserDAO, { ChatUser, User } from '../../dao/UserDAO.js';
import RollcallPlayerDAO, { RollcallPlayer } from '../../dao/RollcallPlayerDAO.js';
import UserPicker, { PickerOption } from '../../UserPicker.js';
import { parseMention, userMention } from '../../mention.js';
import { tellDiscord } from '../../messenger.js';

// The menus /rollcall_add_player and /rollcall_remove_player show when nobody is named.
class RollcallPlayerPicker {
    private readonly adding = new UserPicker('rollcall_add:');
    private readonly removing = new UserPicker('rollcall_remove:');
    private readonly userDao: UserDAO;
    private readonly rosterDao: RollcallPlayerDAO;

    constructor(userDao: UserDAO = new UserDAO(), rosterDao: RollcallPlayerDAO = new RollcallPlayerDAO()) {
        this.userDao = userDao;
        this.rosterDao = rosterDao;
    }

    async askWhoToAdd(bot: Bot, msg: ExtendedMessage): Promise<unknown> {
        const [users, roster] = await Promise.all([this.userDao.getChatUsers(msg.chat.id), this.rosterDao.getRollcallPlayers(msg.chat.id)]);
        const candidates: ChatUser[] = users.filter(user => !roster.some(player => RollcallPlayerPicker.isPlayer(player, user)));
        return candidates.length === 0
            ? msg.reply('Everyone I know here is already in the rollcall.')
            : this.adding.ask(bot, msg, 'Who would you like to add?', UserPicker.options(candidates));
    }

    async askWhoToRemove(bot: Bot, msg: ExtendedMessage): Promise<unknown> {
        const roster: RollcallPlayer[] = await this.rosterDao.getRollcallPlayers(msg.chat.id);
        if (roster.length === 0) {
            return msg.reply('No players in the rollcall.');
        }
        const users: Record<number, User> = await this.userDao.getUsers(roster.map(player => parseMention(player.mention).id).filter(id => id !== undefined));
        const options: PickerOption[] = roster.map(player => {
            const { id, display } = parseMention(player.mention);
            const discordOnly: boolean = id !== undefined && users[id]?.telegram_id === undefined && users[id]?.discord_id !== undefined;
            return { id: player.id, label: discordOnly ? `${display} (Discord)` : display };
        });
        return this.removing.ask(bot, msg, 'Who would you like to remove?', options);
    }

    // Returns true when the tap was on one of these menus.
    handle(bot: Bot, query: CallbackQuery): boolean {
        const message: Message | undefined = query.message as Message | undefined;
        if (!message || !(this.adding.handles(query) || this.removing.handles(query))) {
            return false;
        }
        const outcome: Promise<string> = this.adding.handles(query)
            ? this.add(message.chat.id, this.adding.picked(query))
            : this.remove(message.chat.id, this.removing.picked(query));
        outcome
            .then(async text => {
                await bot.api.editMessageText({ chat_id: message.chat.id, message_id: message.message_id, text });
                await tellDiscord(message.chat.id, text);
                await bot.api.answerCallbackQuery({ callback_query_id: query.id });
            })
            .catch((err: Error) => console.error('Error handling rollcall player menu tap:', err));
        return true;
    }

    private static isPlayer(player: RollcallPlayer, user: ChatUser): boolean {
        const { id, username } = parseMention(player.mention);
        return id === user.user_id || (username !== undefined && username.toLowerCase() === user.username?.toLowerCase());
    }

    private async add(chat_id: number, user_id: number): Promise<string> {
        const user: ChatUser | undefined = (await this.userDao.getChatUsers(chat_id)).find(candidate => candidate.user_id === user_id);
        if (!user) {
            return 'I don\'t know them anymore.';
        } else if ((await this.rosterDao.getRollcallPlayers(chat_id)).some(player => RollcallPlayerPicker.isPlayer(player, user))) {
            return `${user.name} is already in the rollcall.`;
        }
        await this.rosterDao.addRollcallPlayer(chat_id, userMention(user.user_id, user.name));
        return `Added ${user.name} to the rollcall.`;
    }

    private async remove(chat_id: number, player_id: number): Promise<string> {
        const removed: RollcallPlayer | undefined = await this.rosterDao.removeRollcallPlayerById(chat_id, player_id);
        return removed ? `Removed ${parseMention(removed.mention).display} from the rollcall.` : 'They are no longer in the rollcall.';
    }
}

export default RollcallPlayerPicker;
