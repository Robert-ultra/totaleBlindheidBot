import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import UserDAO from '../dao/UserDAO.js';
import { formatError } from '../utils.js';
import { normaliseTimezone } from '../timeUtils.js';

const dao = new UserDAO();

export default (bot: Bot, cmd: Command): Promise<unknown> => {
    const argument: string = cmd.command.argument;
    const user_id: number = cmd.user.id;

    if (!argument) {
        return dao.getUserTimezone(user_id)
            .then((timezone: string) => cmd.reply(`Your current timezone is ${timezone}`))
            .catch((err: Error) => cmd.reply(formatError(err)));
    }

    const normalisedTz: string | null = normaliseTimezone(argument);
    if (!normalisedTz) {
        return cmd.reply(`Invalid timezone: ${argument}`);
    }

    return dao.setUserTimezone(user_id, normalisedTz)
        .then(() => cmd.reply(`Your timezone has been set to ${normalisedTz}`))
        .catch((err: Error) => cmd.reply(formatError(err)));
};
