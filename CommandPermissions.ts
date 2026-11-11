import { Bot } from 'node-telegram-bot-api';
import { PermissionFlagsBits } from 'discord.js';
import { Command } from './MessageRouter.js';
import { isBotAdmin, isChatAdmin } from './admin.js';

export type AdminLevel = 'server' | 'bot';

// On Discord a bot admin also needs Manage Server, so a linked account can't act in servers it doesn't run.
class CommandPermissions {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    async isAdmin(cmd: Command, level: AdminLevel): Promise<boolean> {
        if (cmd.platform === 'telegram') {
            return level === 'bot' ? isBotAdmin(cmd.user.telegram_id) : isChatAdmin(this.bot, cmd.chat_id, cmd.user.telegram_id);
        }
        const managesServer: boolean = cmd.discord?.interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
        return managesServer && (level === 'server' || isBotAdmin(cmd.user.telegram_id));
    }
}

export default CommandPermissions;
