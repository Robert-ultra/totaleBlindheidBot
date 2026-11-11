import { Bot } from 'node-telegram-bot-api';
import { Command, ExtendedMessage } from '../../MessageRouter.js';
import { formatError } from '../../utils.js';
import RollcallPlayerDAO from '../../dao/RollcallPlayerDAO.js';
import { parsePlayerMentions, playerReferences } from './parsePlayerMentions.js';
import RollcallPlayerPicker from './RollcallPlayerPicker.js';
import { parseMention } from '../../mention.js';

const dao = new RollcallPlayerDAO();
const picker = new RollcallPlayerPicker();

export const NAME_A_PLAYER = 'Name a player with the user or discord option.';

export default (bot: Bot, cmd: Command): Promise<unknown> => {
    if (playerReferences(cmd).length === 0) {
        return (cmd.platform === 'telegram' ? picker.askWhoToAdd(bot, cmd as ExtendedMessage) : cmd.reply(NAME_A_PLAYER))
            .catch((err: Error) => cmd.reply(formatError(err)));
    }

    return parsePlayerMentions(cmd)
        .then(parsed => {
            if ('error' in parsed) {
                return cmd.reply(parsed.error);
            }
            const { players } = parsed;
            return dao.getRollcallPlayerUsernames(cmd.chat_id)
                .then((existingPlayers: string[]) => {
                    const existingIds: (number | undefined)[] = existingPlayers.map(existing => parseMention(existing).id);
                    players.forEach(player => {
                        const id: number | undefined = parseMention(player).id;
                        if (existingPlayers.includes(player) || (id !== undefined && existingIds.includes(id))) {
                            throw new Error(`Player ${player} is already in the rollcall.`);
                        }
                    });
                })
                .then(() => Promise.all(players.map(player => dao.addRollcallPlayer(cmd.chat_id, player))))
                .then(() => cmd.reply(`Added ${players.length} players to rollcall.`));
        })
        .catch((err: Error) => cmd.reply(formatError(err)));
}
