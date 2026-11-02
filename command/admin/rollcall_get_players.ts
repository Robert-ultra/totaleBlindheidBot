import { Bot } from 'node-telegram-bot-api';
import { Command } from '../../MessageRouter.js';
import { formatError } from '../../utils.js';
import RollcallPlayerDAO from '../../dao/RollcallPlayerDAO.js';
import { displayName, parseMention } from '../../mention.js';

const dao = new RollcallPlayerDAO();

export default (bot: Bot, msg: Command): Promise<unknown> =>
    dao.getRollcallPlayerUsernames(msg.chat_id)
        .then((players: string[]) => {
            if (players.length === 0) {
                return msg.reply('No players in the rollcall.');
            }
            return msg.reply(`Players in rollcall:\n${players.map((p: string) => `- ${displayName(parseMention(p).display)}`).join('\n')}`);
        })
        .catch((err: Error) => msg.reply(formatError(err)));
