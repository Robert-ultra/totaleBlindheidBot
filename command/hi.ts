import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import { userDisplayName } from '../dao/UserDAO.js';

export default (bot: Bot, cmd: Command): Promise<unknown> =>
    cmd.reply(`Hello to you too, ${userDisplayName(cmd.user)}!`);
