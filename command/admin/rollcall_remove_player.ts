import { Bot } from 'node-telegram-bot-api';
import { Command, ExtendedMessage } from '../../MessageRouter.js';
import { formatError } from '../../utils.js';
import RollcallPlayerDAO from '../../dao/RollcallPlayerDAO.js';
import { parsePlayerMentions, playerReferences } from './parsePlayerMentions.js';
import RollcallPlayerPicker from './RollcallPlayerPicker.js';
import { NAME_A_PLAYER } from './rollcall_add_player.js';

const dao = new RollcallPlayerDAO();
const picker = new RollcallPlayerPicker();

export default (bot: Bot, cmd: Command): Promise<unknown> => {
    if (playerReferences(cmd).length === 0) {
        return (cmd.platform === 'telegram' ? picker.askWhoToRemove(bot, cmd as ExtendedMessage) : cmd.reply(NAME_A_PLAYER))
            .catch((err: Error) => cmd.reply(formatError(err)));
    }

    return parsePlayerMentions(cmd, true)
        .then(parsed => {
            if ('error' in parsed) {
                return cmd.reply(parsed.error);
            }
            return Promise.all(parsed.players.map(player => dao.removeRollcallPlayer(cmd.chat_id, player)))
                .then((results: boolean[]) => cmd.reply(results.every(r => r === false) ? 'Who are they?' : 'Poof! They\'re gone!'));
        })
        .catch((err: Error) => cmd.reply(formatError(err)));
}
