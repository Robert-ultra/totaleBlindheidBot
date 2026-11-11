import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import CommandPermissions from '../CommandPermissions.js';
import UserDAO, { User, userDisplayName } from '../dao/UserDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { notFoundMessage, parseDiscordRef, resolveDiscordUser, resolveTelegramUser } from '../discord/users.js';
import { formatError } from '../utils.js';
import { NOT_CONFIGURED } from './link_chat.js';

const userDao = new UserDAO();

export const ADMIN_ONLY = 'Only a group admin can link or unlink users.';
export const USAGE = 'Usage: /link_user <Telegram username> <Discord username>';
const DISCORD_USAGE = 'Name the Telegram user with the user option and the Discord user with the discord option.';

const references = (cmd: Command): string[] => cmd.platform === 'discord'
    ? [cmd.command.options.user, cmd.command.options.discord].filter((reference): reference is string => reference !== undefined)
    : cmd.command.argumentTokens;

export default async (bot: Bot, msg: Command): Promise<void> => {
    try {
        if (!DiscordService.instance) {
            await msg.reply(NOT_CONFIGURED);
            return;
        } else if (!(await new CommandPermissions(bot).isAdmin(msg, 'server'))) {
            await msg.reply(ADMIN_ONLY);
            return;
        }

        const [first, second] = references(msg);
        const discord_username: string = parseDiscordRef(second ?? '') ?? (second ?? '').replace(/^@/, '').toLowerCase();
        if (references(msg).length !== 2 || discord_username === '') {
            await msg.reply(msg.platform === 'discord' ? DISCORD_USAGE : USAGE);
            return;
        }

        const telegramUser: User | undefined = await resolveTelegramUser(msg, first);
        if (!telegramUser) {
            await msg.reply(`I don't know ${first}. They need to have sent a message in a chat I'm in.`);
            return;
        } else if (telegramUser.discord_id && telegramUser.discord_username === discord_username) {
            await msg.reply(`${userDisplayName(telegramUser)} is already linked to Discord user ${discord_username}.`);
            return;
        } else if (telegramUser.discord_id) {
            await msg.reply(`${userDisplayName(telegramUser)} is already linked to Discord user ${telegramUser.discord_username}. Unlink them first with /unlink_user.`);
            return;
        }

        const discordUser: User | undefined = await resolveDiscordUser(msg.chat_id, discord_username);
        if (!discordUser) {
            await msg.reply(notFoundMessage(discord_username));
            return;
        } else if (discordUser.id === telegramUser.id) {
            await msg.reply(`${userDisplayName(telegramUser)} is already linked to Discord user ${discord_username}.`);
            return;
        } else if (discordUser.telegram_id !== undefined) {
            await msg.reply(`Discord user ${discord_username} is already linked to ${userDisplayName(discordUser)}. Unlink them first with /unlink_user.`);
            return;
        }

        const linked: User = await userDao.linkDiscord(telegramUser.id, {
            id: discordUser.discord_id!,
            username: discordUser.discord_username!,
            global_name: discordUser.discord_name
        });
        await msg.reply(`Linked ${userDisplayName(linked)} to Discord user ${linked.discord_username}.`);
    } catch (err: any) {
        await msg.reply(formatError(err));
    }
};
