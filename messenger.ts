import { Bot, Message as TelegramMessage } from 'node-telegram-bot-api';
import ChatLinkDAO, { ChatLink } from './dao/ChatLinkDAO.js';
import RelayedMessageDAO, { CopyKind, MessageRef, RelayedMessage } from './dao/RelayedMessageDAO.js';
import { RsvpMessageWhere } from './dao/RsvpDAO.js';
import DiscordService, { rsvpComponents } from './discord/DiscordService.js';
import { toDiscordMarkdown } from './discord/markdown.js';
import { asFormatted, Formatted, messageText, Part } from './format.js';
import { Command } from './MessageRouter.js';
import { keyboard, RsvpKeyboardKind } from './rsvp.js';

const chatLinkDao = new ChatLinkDAO();
const relayedDao = new RelayedMessageDAO();

export type Target = Command | { chat_id: number };

export interface BroadcastOptions {
    keyboard?: RsvpKeyboardKind;
    linkPreview?: boolean;
    // The Telegram message to answer, when the target is not a command.
    replyTo?: number;
}

export interface Broadcast {
    telegram?: TelegramMessage;
    discord: { link: ChatLink; where: RsvpMessageWhere & { platform: 'discord' } }[];
}

// The sender's own platform gets its copy as the command's reply; a second reply to a Discord
// command follows the first up rather than replacing it.
export const broadcast = async (bot: Bot, target: Target, telegram: Formatted, discord: string, opts: BroadcastOptions = {}): Promise<Broadcast> => {
    const cmd: Command | undefined = 'platform' in target ? target : undefined;
    const result: Broadcast = { discord: [] };
    const replyTo: number | undefined = cmd?.telegram?.message_id ?? opts.replyTo;

    try {
        result.telegram = await bot.api.sendMessage({
            chat_id: target.chat_id,
            ...messageText(telegram),
            ...(replyTo !== undefined ? { reply_parameters: { message_id: replyTo } } : {}),
            ...(opts.keyboard ? { reply_markup: keyboard(opts.keyboard) } : {}),
            ...(opts.linkPreview === false ? { link_preview_options: { is_disabled: true } } : {})
        });
    } catch (err) {
        console.error(`Could not post to Telegram chat ${target.chat_id}:`, err);
    }

    const service: DiscordService | null = DiscordService.instance;
    if (!service) {
        return result;
    }
    const components = opts.keyboard ? rsvpComponents(opts.keyboard) : undefined;
    const links: ChatLink[] = await chatLinkDao.getLinks(target.chat_id);
    const copies = await Promise.all(links.map(async link => {
        try {
            const origin = cmd?.discord && cmd.discord.link.discord_channel_id === link.discord_channel_id ? cmd.discord.interaction : undefined;
            const answer = { content: discord, allowedMentions: { parse: ['users' as const] }, components: components ?? [] };
            const message_id: string = origin
                ? (await (origin.replied ? origin.followUp(answer) : origin.editReply(answer))).id
                : await service.sendAsBot(link.discord_channel_id, discord, components);
            return { link, where: { platform: 'discord' as const, channel_id: link.discord_channel_id, message_id } };
        } catch (err) {
            console.error(`Could not post to Discord channel ${link.discord_channel_id}:`, err);
            return undefined;
        }
    }));
    result.discord.push(...copies.filter((copy): copy is Broadcast['discord'][number] => copy !== undefined));
    return result;
};

// For outcomes Telegram shows by editing a message Discord never got.
export const tellDiscord = async (chat_id: number, text: Part): Promise<void> => {
    const service: DiscordService | null = DiscordService.instance;
    if (!service) {
        return;
    }
    const content: string = toDiscordMarkdown(asFormatted(text));
    const links: ChatLink[] = await chatLinkDao.getLinks(chat_id);
    await Promise.all(links.map(link => service.sendAsBot(link.discord_channel_id, content)
        .catch((err: Error) => console.error(`Could not post to Discord channel ${link.discord_channel_id}:`, err))));
};

type DiscordCopy = MessageRef & { kind: CopyKind };

const postCopies = async (chat_id: number, sent: TelegramMessage, text: Formatted, author: string): Promise<void> => {
    const service: DiscordService | null = DiscordService.instance;
    if (!service) {
        return;
    }
    const links: ChatLink[] = await chatLinkDao.getLinks(chat_id);
    const copies = await Promise.all(links.map(link => service.sendAsBot(link.discord_channel_id, toDiscordMarkdown(text))
        .then((message_id): DiscordCopy => ({ platform: 'discord', chat_id: link.discord_channel_id, message_id, kind: 'bot' }))
        .catch((err: Error) => {
            console.error(`Could not post to Discord channel ${link.discord_channel_id}:`, err);
            return undefined;
        })));
    await relayedDao.record(
        { platform: 'telegram', chat_id: String(chat_id), message_id: String(sent.message_id) },
        author,
        copies.filter((copy): copy is DiscordCopy => copy !== undefined)
    );
};

// For bot messages that keep being edited, such as live game updates: the copies are remembered so
// editMirrored reaches them. Only the Telegram send can fail the call.
export const sendMirrored = async (bot: Bot, chat_id: number, text: Formatted, author: string): Promise<TelegramMessage> => {
    const sent: TelegramMessage = await bot.api.sendMessage({ chat_id, ...messageText(text) });
    await postCopies(chat_id, sent, text, author)
        .catch((err: Error) => console.error(`Could not mirror message ${sent.message_id} of chat ${chat_id} to Discord:`, err));
    return sent;
};

// Remembers a broadcast's Discord copies so editDiscordCopies can reach them.
export const rememberCopies = async (chat_id: number, sent: Broadcast, author: string): Promise<void> => {
    if (sent.telegram) {
        await relayedDao.record(
            { platform: 'telegram', chat_id: String(chat_id), message_id: String(sent.telegram.message_id) },
            author,
            sent.discord.map(copy => ({ platform: 'discord', chat_id: copy.where.channel_id, message_id: copy.where.message_id, kind: 'bot' }))
        );
    }
};

export const editDiscordCopies = async (chat_id: number, message_id: number, content: string): Promise<void> => {
    const service: DiscordService | null = DiscordService.instance;
    const origin: RelayedMessage | undefined = await relayedDao.find({ platform: 'telegram', chat_id: String(chat_id), message_id: String(message_id) });
    if (!service || !origin) {
        return;
    }
    const copies: RelayedMessage[] = (await relayedDao.group(origin)).filter(message => message.platform === 'discord');
    await Promise.all(copies.map(copy => service.editMessage(copy.chat_id, copy.message_id, content)
        .catch((err: Error) => console.error(`Could not edit Discord message ${copy.message_id} in channel ${copy.chat_id}:`, err))));
};

export const editMirrored = async (bot: Bot, chat_id: number, message_id: number, text: Formatted): Promise<void> => {
    await bot.api.editMessageText({ ...messageText(text), chat_id, message_id });
    await editDiscordCopies(chat_id, message_id, toDiscordMarkdown(text))
        .catch((err: Error) => console.error(`Could not mirror the edit of message ${message_id} in chat ${chat_id} to Discord:`, err));
};
