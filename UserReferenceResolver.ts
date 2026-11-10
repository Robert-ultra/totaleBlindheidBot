import UserDAO, { User } from './dao/UserDAO.js';
import { notFoundMessage, parseDiscordRef, resolveDiscordUser } from './discord/users.js';

// How commands name someone: "@name" is a Telegram username, "discord:name" a Discord one, and a
// bare name whichever of the two is known, Telegram first.
class UserReferenceResolver {
    private readonly userDao: UserDAO;

    constructor(userDao: UserDAO = new UserDAO()) {
        this.userDao = userDao;
    }

    async telegram(reference: string): Promise<User | undefined> {
        const user_id: number | undefined = await this.userDao.getUserIdByUsername(reference.replace(/^@/, ''));
        return user_id === undefined ? undefined : this.userDao.getUser(user_id);
    }

    async resolve(telegram_chat_id: number, reference: string): Promise<User | undefined> {
        const discord_username: string | undefined = parseDiscordRef(reference);
        if (discord_username !== undefined) {
            return resolveDiscordUser(telegram_chat_id, discord_username);
        } else if (reference.startsWith('@')) {
            return this.telegram(reference);
        }
        return await this.telegram(reference) ?? resolveDiscordUser(telegram_chat_id, reference.toLowerCase());
    }

    static unknown(reference: string): string {
        const discord_username: string | undefined = parseDiscordRef(reference);
        return discord_username !== undefined ? notFoundMessage(discord_username) : `I don't know ${reference}.`;
    }
}

export default UserReferenceResolver;
