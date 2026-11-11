import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import CommandPermissions from '../CommandPermissions.js';
import ChatLinkDAO, { ChatLink } from '../dao/ChatLinkDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { formatError } from '../utils.js';
import { ADMIN_ONLY, NOT_CONFIGURED, isSnowflake } from './link_chat.js';

const chatLinkDao = new ChatLinkDAO();

export const UNLINKED_NOTICE = 'This channel is no longer linked to Telegram.';

// Discord-side failures (kicked, lost permissions) don't stop the unlink. A server left without
// linked channels loses its slash commands.
const tearDown = async (discord: DiscordService, link: ChatLink): Promise<void> => {
    await chatLinkDao.removeLink(link.telegram_chat_id, link.discord_channel_id);
    if (!(await chatLinkDao.getAllLinks()).some(other => other.discord_guild_id === link.discord_guild_id)) {
        await discord.unregisterCommands(link.discord_guild_id)
            .catch((err: Error) => console.error(`Could not remove the slash commands of Discord server ${link.discord_guild_id}:`, err));
    }
    if (link.webhook_id && link.webhook_token) {
        await discord.deleteWebhook({ id: link.webhook_id, token: link.webhook_token })
            .catch((err: Error) => console.error(`Could not delete webhook ${link.webhook_id}:`, err));
    }
    await discord.sendAsBot(link.discord_channel_id, UNLINKED_NOTICE)
        .catch((err: Error) => console.error(`Could not announce unlink in Discord channel ${link.discord_channel_id}:`, err));
};

// On Discord only channels of the server the command is given in can be unlinked.
const unlinkOne = async (cmd: Command, discord: DiscordService, channel_id: string): Promise<unknown> => {
    if (!isSnowflake(channel_id)) {
        return cmd.replyPrivately('Usage: /unlink_chat [Discord channel id]. Without an id, every linked channel is unlinked.');
    }
    const link: ChatLink | undefined = await chatLinkDao.getLinkByChannel(channel_id);
    if (!link || link.telegram_chat_id !== cmd.chat_id || (cmd.discord && link.discord_guild_id !== cmd.discord.link.discord_guild_id)) {
        return cmd.replyPrivately('That channel is not linked to this group.');
    }
    await tearDown(discord, link);
    return cmd.replyPrivately(`Unlinked Discord channel ${channel_id}.`);
};

export default async (bot: Bot, cmd: Command): Promise<void> => {
    try {
        const discord: DiscordService | null = DiscordService.instance;
        if (!discord) {
            await cmd.replyPrivately(NOT_CONFIGURED);
            return;
        } else if (!(await new CommandPermissions(bot).isAdmin(cmd, 'server'))) {
            await cmd.replyPrivately(ADMIN_ONLY);
            return;
        }

        const channel_id: string | undefined = cmd.command.argumentTokens[0] ?? cmd.discord?.link.discord_channel_id;
        if (channel_id !== undefined) {
            await unlinkOne(cmd, discord, channel_id);
            return;
        }

        const links: ChatLink[] = await chatLinkDao.getLinks(cmd.chat_id);
        if (links.length === 0) {
            await cmd.replyPrivately('No Discord channels are linked to this group.');
            return;
        }
        await Promise.all(links.map(link => tearDown(discord, link)));
        await cmd.replyPrivately(`Unlinked ${links.length} Discord channel${links.length === 1 ? '' : 's'}.`);
    } catch (err: any) {
        await cmd.replyPrivately(formatError(err));
    }
};
