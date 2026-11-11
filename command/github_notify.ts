import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import GithubDAO from '../dao/GithubDAO.js';
import { formatError } from '../utils.js';

const dao = new GithubDAO();

export default (bot: Bot, cmd: Command): Promise<unknown> => {
    const arg: string = cmd.command.argument.toLowerCase();
    if (arg !== 'on' && arg !== 'off') {
        return cmd.reply('Please specify "on" or "off" to enable or disable GitHub notifications for this chat.');
    }

    return dao.setGithubNotify(cmd.chat_id, arg === 'on')
        .then(() => cmd.reply(`GitHub notifications for this chat have been turned ${arg}.`))
        .catch((err: Error) => cmd.reply(formatError(err)));
};
