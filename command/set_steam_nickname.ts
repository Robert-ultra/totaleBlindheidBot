import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import CommandPermissions from '../CommandPermissions.js';
import SteamService from '../SteamService.js';

// Steam's own limit on profile names.
const MAX_LENGTH = 32;

export default async (bot: Bot, msg: Command): Promise<unknown> => {
    const nickname: string = msg.command.argument;
    const steam: SteamService | null = SteamService.instance;
    if (!(await new CommandPermissions(bot).isAdmin(msg, 'bot'))) {
        return msg.reply('Only the admin can change my Steam nickname.');
    } else if (nickname === '' || nickname.length > MAX_LENGTH) {
        return msg.reply(`Usage: /set_steam_nickname <new nickname of at most ${MAX_LENGTH} characters>`);
    } else if (!steam?.setNickname(nickname)) {
        return msg.reply('I am not logged on to Steam right now.');
    }
    return msg.reply(`My Steam nickname is now ${nickname}.`);
};
