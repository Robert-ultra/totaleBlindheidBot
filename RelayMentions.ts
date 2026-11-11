import { MessageEntity } from 'node-telegram-bot-api';
import UserDAO, { User, userDisplayName } from './dao/UserDAO.js';
import { DISCORD_USER_MENTION, toDiscordMarkdown } from './discord/markdown.js';
import { Formatted, join, link, Part } from './format.js';

// Tags people whose Telegram and Discord accounts are linked on the platform a message is relayed to.
class RelayMentions {
    private readonly userDao: UserDAO;

    constructor(userDao: UserDAO = new UserDAO()) {
        this.userDao = userDao;
    }

    async toDiscord(formatted: Formatted): Promise<string> {
        const tagged = await Promise.all(formatted.entities.map(async entity => {
            const discord_id: string | undefined = (await this.mentioned(formatted, entity))?.discord_id;
            return discord_id === undefined ? undefined : [entity, `<@${discord_id}>`] as const;
        }));
        return toDiscordMarkdown(formatted, new Map(tagged.filter(tag => tag !== undefined)));
    }

    // `clean` spells out whatever is not tagged, like discord.js cleanContent.
    async toTelegram(content: string, clean: (text: string) => string): Promise<Formatted> {
        const users: Record<string, User> = await this.userDao.getUsersByDiscordIds([...content.matchAll(DISCORD_USER_MENTION)].map(match => match[1]));
        const parts: Part[] = content.split(DISCORD_USER_MENTION).map((part, i) => {
            const telegram_id: number | undefined = i % 2 === 1 ? users[part]?.telegram_id : undefined;
            return telegram_id === undefined
                ? clean(i % 2 === 1 ? `<@${part}>` : part)
                : link(`@${userDisplayName(users[part])}`, `tg://user?id=${telegram_id}`);
        });
        return join(parts, '');
    }

    private async mentioned(formatted: Formatted, entity: MessageEntity): Promise<User | undefined> {
        if (entity.type === 'text_mention' && entity.user) {
            return this.userDao.getUserByTelegramId(entity.user.id);
        } else if (entity.type !== 'mention') {
            return undefined;
        }
        const user_id: number | undefined = await this.userDao.getUserIdByUsername(formatted.text.slice(entity.offset + 1, entity.offset + entity.length));
        return user_id === undefined ? undefined : this.userDao.getUser(user_id);
    }
}

export default RelayMentions;
