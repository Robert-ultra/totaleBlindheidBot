import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import ChatDAO from '../dao/ChatDAO.js';
import { formatError } from '../utils.js';

const dao = new ChatDAO();

export default (bot: Bot, cmd: Command): Promise<unknown> => {
    const arg: string = cmd.command.argument.toLowerCase();
    if (arg !== 'on' && arg !== 'off') {
        return cmd.reply('Please specify "on" or "off" to enable or disable Steam updates for this chat.');
    }

    return dao.setChatSettings(cmd.chat_id, { steam_updates: arg === 'on' })
        .then(() => cmd.reply(`Steam updates for this chat have been turned ${arg}.`))
        .catch((err: Error) => cmd.reply(formatError(err)));
};
