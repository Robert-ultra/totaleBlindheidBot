import { Bot, CallbackQuery, Message } from 'node-telegram-bot-api';
import { ButtonInteraction, MessageFlags } from 'discord.js';
import RsvpDAO, { Rsvp, RsvpEntry, RsvpList } from './dao/RsvpDAO.js';
import UserDAO, { User } from './dao/UserDAO.js';
import { ChatLink } from './dao/ChatLinkDAO.js';
import { entryFromUser, lobby, Lobby, LOBBY_SIZE } from './rsvp.js';
import { renderRsvpList, rsvpLockKey, withLock } from './taggedMessages.js';
import { userMention } from './mention.js';
import { mentionUsers, withTags } from './presence.js';
import { withDiscordTags } from './discord/render.js';
import { broadcast } from './messenger.js';
import { asFormatted, Formatted } from './format.js';

const PREFIX = 'rsvp:';
const EXPIRED = 'This RSVP has expired.';
const CHOICES: Rsvp[] = ['yes', 'maybe', 'no'];

type Render = (bot: Bot, rsvp_id: number) => Promise<void>;
type Ping = (bot: Bot, chat_id: number, text: string, people: RsvpEntry[]) => Promise<unknown>;

const pingPeople: Ping = async (bot, chat_id, text, people) => {
    const tags: string[] = people.map(person => userMention(person.user_id, person.name));
    const head: Formatted = asFormatted(text);
    const users = await mentionUsers(tags);
    return broadcast(bot, { chat_id }, withTags(head, tags, users), withDiscordTags(head, tags, users));
};

class RsvpTapHandler {
    private readonly bot: Bot;
    private readonly rsvpDao: RsvpDAO;
    private readonly userDao: UserDAO;
    private readonly render: Render;
    private readonly ping: Ping;

    constructor(bot: Bot, rsvpDao: RsvpDAO = new RsvpDAO(), userDao: UserDAO = new UserDAO(), render: Render = renderRsvpList, ping: Ping = pingPeople) {
        this.bot = bot;
        this.rsvpDao = rsvpDao;
        this.userDao = userDao;
        this.render = render;
        this.ping = ping;
    }

    static parse(data: string | undefined): Rsvp | undefined {
        if (!data?.startsWith(PREFIX)) {
            return undefined;
        }
        const rsvp = data.substring(PREFIX.length) as Rsvp;
        return CHOICES.includes(rsvp) ? rsvp : undefined;
    }

    async handleTelegram(query: CallbackQuery): Promise<void> {
        const rsvp: Rsvp | undefined = RsvpTapHandler.parse(query.data);
        const message: Message | undefined = query.message;
        if (!rsvp || !message) {
            return;
        }
        try {
            const list: RsvpList | undefined = await this.rsvpDao.getRsvpListByMessage(message.chat.id, message.message_id);
            if (!list) {
                await this.bot.api.answerCallbackQuery({ callback_query_id: query.id, text: EXPIRED });
                return;
            }
            const user: User = await this.userDao.fromTelegram(query.from);
            await this.record(list, user, rsvp);
            await this.bot.api.answerCallbackQuery({ callback_query_id: query.id });
        } catch (err) {
            console.error('Error handling RSVP callback:', err);
            await this.bot.api.answerCallbackQuery({ callback_query_id: query.id, text: 'Something went wrong.' }).catch(() => undefined);
        }
    }

    async handleDiscord(interaction: ButtonInteraction, link: ChatLink): Promise<void> {
        const rsvp: Rsvp | undefined = RsvpTapHandler.parse(interaction.customId);
        if (!rsvp) {
            return;
        }
        const list: RsvpList | undefined = await this.rsvpDao.getRsvpListByDiscordMessage(interaction.channelId, interaction.message.id);
        if (!list) {
            await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral });
            return;
        }
        const user: User = await this.userDao.fromDiscord({ id: interaction.user.id, username: interaction.user.username, global_name: interaction.user.globalName });
        await this.userDao.addUserChat(user.id, link.telegram_chat_id);
        await interaction.deferUpdate();
        await this.record(list, user, rsvp);
    }

    private async record(list: RsvpList, user: User, rsvp: Rsvp): Promise<void> {
        const [before, updated] = await withLock(rsvpLockKey(list.rsvp_id), async () => [
            await this.rsvpDao.getRsvpList(list.rsvp_id),
            await this.rsvpDao.setRsvpEntry(list.rsvp_id, entryFromUser(user, rsvp))
        ]);
        if (!updated) {
            return;
        }
        await this.render(this.bot, updated.rsvp_id);
        await this.announce(updated.chat_id, lobby((before ?? list).entries), lobby(updated.entries));
    }

    private async announce(chat_id: number, before: Lobby, after: Lobby): Promise<void> {
        if (before.players.length < LOBBY_SIZE && after.players.length === LOBBY_SIZE) {
            await this.ping(this.bot, chat_id, 'Lobby full! ', after.players);
        }
        const promoted: RsvpEntry[] = after.players.filter(player => before.waiting.some(waiting => waiting.user_id === player.user_id));
        if (promoted.length > 0) {
            await this.ping(this.bot, chat_id, "A spot opened up, you're in: ", promoted);
        }
    }
}

export default RsvpTapHandler;
