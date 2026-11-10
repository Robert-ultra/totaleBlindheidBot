import { Bot } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../MessageRouter.js';
import { isBotAdmin } from '../admin.js';
import SteamService from '../SteamService.js';

// Steam's own limit on profile names.
const MAX_LENGTH = 32;

export default (bot: Bot, msg: ExtendedMessage): Promise<unknown> => {
    const nickname: string = msg.command.argument;
    const steam: SteamService | null = SteamService.instance;
    if (!isBotAdmin(msg.from?.id)) {
        return msg.reply('Only the admin can change my Steam nickname.');
    } else if (nickname === '' || nickname.length > MAX_LENGTH) {
        return msg.reply(`Usage: /steam_nickname <new nickname of at most ${MAX_LENGTH} characters>`);
    } else if (!steam?.setNickname(nickname)) {
        return msg.reply('I am not logged on to Steam right now.');
    }
    return msg.reply(`My Steam nickname is now ${nickname}.`);
};
