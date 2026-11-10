import { Bot } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../MessageRouter.js';
import SteamService from '../SteamService.js';

export default (bot: Bot, msg: ExtendedMessage): void => {
    const adminId: string | undefined = process.env.STEAM_ADMIN_TELEGRAM_USER_ID;
    if (!adminId) {
        console.warn('STEAM_ADMIN_TELEGRAM_USER_ID is not set; refusing /steam_guard from user ' + msg.from?.id);
        return;
    } else if (String(msg.from?.id) !== String(adminId)) {
        console.warn(`Unauthorized attempt to use /steam_guard by user ${msg.from?.id}`);
        return;
    }

    const code: string | undefined = msg.command?.argument;
    if (!code) {
        msg.replyPrivately('Please specify the Steam Guard code.');
        return;
    }

    const steamService = SteamService.instance;
    if (!steamService) {
        msg.replyPrivately('Steam service is not enabled.');
        return;
    } else if (steamService.submitSteamGuardCode(code)) {
        msg.replyPrivately('Steam Guard code submitted.');
    } else {
        msg.replyPrivately('No Steam Guard code is currently requested, or it was already provided.');
    }
};
