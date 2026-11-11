import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import CommandPermissions from '../CommandPermissions.js';
import SteamService from '../SteamService.js';

export default async (bot: Bot, cmd: Command): Promise<unknown> => {
    if (!(await new CommandPermissions(bot).isAdmin(cmd, 'bot'))) {
        console.warn(`Unauthorized attempt to use /steam_guard by user ${cmd.user.id}`);
        return;
    }

    const code: string = cmd.command.argument;
    if (!code) {
        return cmd.replyPrivately('Please specify the Steam Guard code.');
    }

    const steamService = SteamService.instance;
    if (!steamService) {
        return cmd.replyPrivately('Steam service is not enabled.');
    } else if (steamService.submitSteamGuardCode(code)) {
        return cmd.replyPrivately('Steam Guard code submitted.');
    }
    return cmd.replyPrivately('No Steam Guard code is currently requested, or it was already provided.');
};
