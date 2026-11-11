import { Bot } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../MessageRouter.js';
import { isChatAdmin } from '../admin.js';
import ChatDAO from '../dao/ChatDAO.js';
import { formatError } from '../utils.js';

const dao = new ChatDAO();

export default async (bot: Bot, msg: ExtendedMessage): Promise<unknown> => {
    try {
        if (!(await isChatAdmin(bot, msg.chat.id, msg.from?.id))) {
            return await msg.reply('Only a group admin can change auto-cancel.');
        }
        const arg: string | undefined = msg.command?.argument?.toLowerCase();
        if (arg !== 'on' && arg !== 'off') {
            return await msg.reply('Usage: /auto_cancel on|off');
        }
        await dao.setAutoCancel(msg.chat.id, arg === 'on');
        return await msg.reply(`Auto-cancel for this chat has been turned ${arg}.`);
    } catch (err) {
        return msg.reply(formatError(err as Error));
    }
};
