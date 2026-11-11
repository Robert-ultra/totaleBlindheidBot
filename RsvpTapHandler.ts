import { Bot, CallbackQuery, Message } from 'node-telegram-bot-api';
import { ButtonInteraction, MessageFlags } from 'discord.js';
import RsvpDAO, { Rsvp, RsvpList } from './dao/RsvpDAO.js';
import UserDAO, { User } from './dao/UserDAO.js';
import { ChatLink } from './dao/ChatLinkDAO.js';
import { entryFromUser } from './rsvp.js';
import { renderRsvpList } from './taggedMessages.js';

const PREFIX = 'rsvp:';
const EXPIRED = 'This RSVP has expired.';
const CHOICES: Rsvp[] = ['yes', 'maybe', 'no'];

type Render = (bot: Bot, rsvp_id: number) => Promise<void>;

class RsvpTapHandler {
    private readonly bot: Bot;
    private readonly rsvpDao: RsvpDAO;
    private readonly userDao: UserDAO;
    private readonly render: Render;

    constructor(bot: Bot, rsvpDao: RsvpDAO = new RsvpDAO(), userDao: UserDAO = new UserDAO(), render: Render = renderRsvpList) {
        this.bot = bot;
        this.rsvpDao = rsvpDao;
        this.userDao = userDao;
        this.render = render;
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
        const updated: RsvpList | undefined = await this.rsvpDao.setRsvpEntry(list.rsvp_id, entryFromUser(user, rsvp));
        if (updated) {
            await this.render(this.bot, updated.rsvp_id);
        }
    }
}

export default RsvpTapHandler;
