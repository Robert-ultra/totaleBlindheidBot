import { Bot } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../../MessageRouter.js';
import { formatError } from '../../utils.js';
import RollcallPlayerDAO from '../../dao/RollcallPlayerDAO.js';
import { parsePlayerMentions } from './parsePlayerMentions.js';
import RollcallPlayerPicker from './RollcallPlayerPicker.js';
import { parseMention } from '../../mention.js';

const dao = new RollcallPlayerDAO();
const picker = new RollcallPlayerPicker();

export default (bot: Bot, msg: ExtendedMessage): void => {
    if ((msg.command?.argumentTokens || []).length === 0) {
        picker.askWhoToAdd(bot, msg).catch((err: Error) => msg.reply(formatError(err)));
        return;
    }

    parsePlayerMentions(msg)
        .then(parsed => {
            if ('error' in parsed) {
                msg.reply(parsed.error);
                return;
            }
            const { players } = parsed;
            return dao.getRollcallPlayerUsernames(msg.chat.id)
                .then((existingPlayers: string[]) => {
                    const existingIds: (number | undefined)[] = existingPlayers.map(existing => parseMention(existing).id);
                    players.forEach(player => {
                        const id: number | undefined = parseMention(player).id;
                        if (existingPlayers.includes(player) || (id !== undefined && existingIds.includes(id))) {
                            throw new Error(`Player ${player} is already in the rollcall.`);
                        }
                    });
                })
                .then(() => Promise.all(players.map(player => dao.addRollcallPlayer(msg.chat.id, player))))
                .then(() => msg.reply(`Added ${players.length} players to rollcall.`));
        })
        .catch((err: Error) => msg.reply(formatError(err)));
}
