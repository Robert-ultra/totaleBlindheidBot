import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import CommandPermissions from '../CommandPermissions.js';
import UserDAO, { User, userDisplayName } from '../dao/UserDAO.js';
import { parseDiscordRef, resolveDiscordUser, resolveTelegramUser } from '../discord/users.js';
import { formatError } from '../utils.js';
import { ADMIN_ONLY } from './link_user.js';

const userDao = new UserDAO();

// On Discord the user option names the Telegram user, the discord option the Discord one.
const target = (cmd: Command): { reference: string; find: () => Promise<User | undefined> } | undefined => {
    const { user, discord } = cmd.command.options;
    if (cmd.platform === 'telegram') {
        const [first] = cmd.command.argumentTokens;
        return cmd.command.argumentTokens.length === 1 ? { reference: first, find: () => resolveTelegramUser(cmd, first) } : undefined;
    } else if (user !== undefined) {
        return { reference: user, find: () => resolveTelegramUser(cmd, user) };
    } else if (discord !== undefined) {
        return { reference: discord, find: () => resolveDiscordUser(cmd.chat_id, parseDiscordRef(discord) ?? discord.replace(/^@/, '').toLowerCase()) };
    }
    return undefined;
};

export default async (bot: Bot, cmd: Command): Promise<void> => {
    try {
        if (!(await new CommandPermissions(bot).isAdmin(cmd, 'server'))) {
            await cmd.reply(ADMIN_ONLY);
            return;
        }
        const named = target(cmd);
        if (!named) {
            await cmd.reply(cmd.platform === 'discord' ? 'Name a user with the user or discord option.' : 'Usage: /unlink_user <Telegram username>');
            return;
        }
        const telegramUser: User | undefined = await named.find();
        if (!telegramUser) {
            await cmd.reply(`I don't know ${named.reference}.`);
            return;
        } else if (telegramUser.telegram_id === undefined) {
            await cmd.reply(`${userDisplayName(telegramUser)} is not linked to a Telegram user.`);
            return;
        } else if (!telegramUser.discord_id) {
            await cmd.reply(`${userDisplayName(telegramUser)} is not linked to a Discord user.`);
            return;
        }
        await userDao.unlinkDiscord(telegramUser.id);
        await cmd.reply(`Unlinked ${userDisplayName(telegramUser)} from Discord user ${telegramUser.discord_username}.`);
    } catch (err: any) {
        await cmd.reply(formatError(err));
    }
};
