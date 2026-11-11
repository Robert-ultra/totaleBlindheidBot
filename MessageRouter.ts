import { Bot, Message } from 'node-telegram-bot-api';
import { ChatInputCommandInteraction } from 'discord.js';
import { formatError } from './utils.js';
import { asFormatted, Formatted, messageText, Part } from './format.js';
import { broadcast } from './messenger.js';
import { toDiscordMarkdown } from './discord/markdown.js';
import { User } from './dao/UserDAO.js';
import { ChatLink } from './dao/ChatLinkDAO.js';
import { SlashCommand, SlashOption } from './discord/DiscordService.js';
import CommandPermissions, { AdminLevel } from './CommandPermissions.js';

export interface CommandContext {
    name: string;
    argument: string;
    argumentTokens: string[];
    // Discord's named options; Telegram has none.
    options: Readonly<Record<string, string>>;
}

// chat_id is the Telegram chat, also for a command typed in a linked Discord channel.
export interface Command {
    platform: 'telegram' | 'discord';
    chat_id: number;
    user: User;
    command: CommandContext;
    // Reaches the chat and every Discord channel linked to it.
    reply: (text: Part) => Promise<unknown>;
    // Reaches only where the command was given.
    replyPrivately: (text: Part) => Promise<unknown>;
    telegram?: Message;
    discord?: { interaction: ChatInputCommandInteraction; link: ChatLink };
}

export interface ExtendedMessage extends Message, Command {
    platform: 'telegram';
    telegram: Message;
}

export type CommandHandler<T extends Command = Command> = (bot: Bot, cmd: T) => void | Promise<void> | Promise<any> | any;

// Returns true when it consumed the message.
export type ReplyHandler = (bot: Bot, msg: Message) => boolean;

export interface DiscordCommandOptions {
    // Fills `command.argument`; the other options fill `command.options`.
    argument?: SlashOption;
    options?: SlashOption[];
    admin?: AdminLevel;
}

const REFUSALS: Record<AdminLevel, string> = {
    server: 'Only someone who can manage this server can use this command.',
    bot: 'Only the bot admin can use this command.'
};

export interface RouteOptions {
    helpText?: string;
    discord?: DiscordCommandOptions;
}

interface Route extends RouteOptions {
    command: string;
    handler: CommandHandler<any>;
}

class MessageRouter {
    private _bot: Bot;
    private _routes: Route[];
    private _replyHandlers: ReplyHandler[];

    constructor(bot: Bot) {
        this._bot = bot;
        this._routes = [];
        this._replyHandlers = [];
    }

    onReply(handler: ReplyHandler): void {
        this._replyHandlers.push(handler);
    }

    route(command: string, handler: CommandHandler<ExtendedMessage>, etc?: RouteOptions & { discord?: undefined }): void;
    route(command: string, handler: CommandHandler<Command>, etc: RouteOptions & { discord: DiscordCommandOptions }): void;
    route(command: string, handler: CommandHandler<any>, etc: RouteOptions = {}): void {
        this._routes.push({
            command,
            handler,
            ...etc
        });
    }

    get discordRoutes(): readonly Route[] {
        return this._routes.filter(route => route.discord);
    }

    get slashCommands(): SlashCommand[] {
        return this.discordRoutes.map(route => ({
            name: route.command,
            description: route.helpText ?? route.command,
            options: [route.discord!.argument, ...(route.discord!.options ?? [])].filter(option => option !== undefined),
            admin: route.discord!.admin !== undefined
        }));
    }

    private _context(name: string, argument: string, options: Record<string, string> = {}): CommandContext {
        return {
            name,
            argument: argument.trim(),
            argumentTokens: argument.split(/\s+/).filter(t => t.length > 0),
            options
        };
    }

    private _mirroredReply(cmd: Command): (text: Part) => Promise<unknown> {
        return (text: Part) => {
            const formatted: Formatted = asFormatted(text);
            return broadcast(this._bot, cmd, formatted, toDiscordMarkdown(formatted));
        };
    }

    handle(msg: Message, user: User): void {
        if (msg.reply_to_message && this._replyHandlers.some(handler => handler(this._bot, msg))) {
            return;
        } else if (!msg.text || !msg.text.startsWith('/')) {
            return;
        }

        const parts: string[] = msg.text.split(/\s+/);
        const commandWithPrefix: string = parts[0];
        const nameWithTarget: string = commandWithPrefix.substring(1).toLowerCase();
        const [name] = nameWithTarget.split('@');

        const route: Route | undefined = this._routes.find(r => r.command.toLowerCase() === name);
        if (!route) {
            return;
        }

        const extendedMsg = msg as ExtendedMessage;
        extendedMsg.platform = 'telegram';
        extendedMsg.chat_id = msg.chat.id;
        extendedMsg.telegram = msg;
        extendedMsg.reply = this._mirroredReply(extendedMsg);
        extendedMsg.replyPrivately = (text: Part) => this._bot.api.sendMessage({
            chat_id: msg.chat.id,
            ...messageText(text),
            reply_parameters: { message_id: msg.message_id }
        });
        extendedMsg.command = this._context(name, msg.text.substring(commandWithPrefix.length));
        extendedMsg.user = user;

        try {
            route.handler(this._bot, extendedMsg);
        } catch (ex: any) {
            extendedMsg.reply(formatError(ex));
        }
    }

    async handleDiscord(interaction: ChatInputCommandInteraction, link: ChatLink, user: User, reply: (text: Part) => Promise<unknown>): Promise<void> {
        const route: Route | undefined = this.discordRoutes.find(r => r.command.toLowerCase() === interaction.commandName.toLowerCase());
        if (!route) {
            await reply('I don\'t know that command.');
            return;
        }
        const argument: string = route.discord?.argument ? (interaction.options.getString(route.discord.argument.name) ?? '') : '';
        const options: Record<string, string> = Object.fromEntries((route.discord?.options ?? [])
            .map(option => [option.name, interaction.options.getString(option.name)])
            .filter((entry): entry is [string, string] => entry[1] !== null));
        const cmd: Command = {
            platform: 'discord',
            chat_id: link.telegram_chat_id,
            user,
            command: this._context(route.command, argument, options),
            reply,
            replyPrivately: reply,
            discord: { interaction, link }
        };
        cmd.reply = this._mirroredReply(cmd);
        const admin: AdminLevel | undefined = route.discord?.admin;
        if (admin && !(await new CommandPermissions(this._bot).isAdmin(cmd, admin))) {
            await reply(REFUSALS[admin]);
            return;
        }
        try {
            await route.handler(this._bot, cmd);
        } catch (ex: any) {
            await reply(formatError(ex));
        }
    }
}

export default MessageRouter;
