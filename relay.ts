import { Bot, Message as TelegramMessage } from 'node-telegram-bot-api';
import { Message as DiscordMessage, PartialMessage } from 'discord.js';
import ChatLinkDAO, { ChatLink } from './dao/ChatLinkDAO.js';
import UserDAO from './dao/UserDAO.js';
import DiscordService from './discord/DiscordService.js';
import RelayedMessageDAO, { CopyKind, MessageRef, RelayedMessage } from './dao/RelayedMessageDAO.js';
import { toDiscordMarkdown } from './discord/markdown.js';
import { bold, fmt, Formatted, messageText } from './format.js';
import { discordMedia, downloadTelegramFile, downloadUrl, RelayFile, sendTelegramFile, telegramMedia, TelegramMedia, TelegramSendKind } from './media.js';

const chatLinkDao = new ChatLinkDAO();
const userDao = new UserDAO();
const relayedDao = new RelayedMessageDAO();

const TELEGRAM_CAPTION_LIMIT = 1024;

export const recordDiscordSender = async (message: DiscordMessage, link: ChatLink): Promise<void> => {
    if (message.author.bot) {
        return;
    }
    const user = await userDao.fromDiscord({
        id: message.author.id,
        username: message.author.username,
        global_name: message.author.globalName
    });
    await userDao.addUserChat(user.id, link.telegram_chat_id);
};

const telegramName = (from: TelegramMessage['from']): string =>
    [from?.first_name, from?.last_name].filter(Boolean).join(' ') || from?.username || 'someone';

export const relayFromTelegram = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
    const discord: DiscordService | null = DiscordService.instance;
    if (!discord) {
        return;
    }
    const media: TelegramMedia | undefined = telegramMedia(msg);
    if (!msg.text && !media) {
        return;
    }
    const links: ChatLink[] = await chatLinkDao.getLinks(msg.chat.id);
    if (links.length === 0) {
        return;
    }

    const content: string = discordContent(msg, media);
    let files: RelayFile[] = [];
    if (media?.file) {
        try {
            files = [await downloadTelegramFile(bot, media.file.file_id, media.file.name)];
        } catch (err) {
            console.error(`Could not download Telegram file ${media.file.file_id}:`, err);
            return;
        }
    }

    const author: string = telegramName(msg.from);
    const copies = await Promise.all(links.map(link => discord.relay(link, author, content, files)
        .then(sent => ({ platform: 'discord' as const, chat_id: link.discord_channel_id, ...sent }))
        .catch((err: Error) => {
            console.error(`Could not relay Telegram message ${msg.message_id} to Discord channel ${link.discord_channel_id}:`, err);
            return undefined;
        })));
    await relayedDao.record(telegramRef(msg), author, copies.filter(isDefined));
};

type Copy = MessageRef & { kind: CopyKind };
const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const telegramRef = (msg: TelegramMessage): MessageRef => ({ platform: 'telegram', chat_id: String(msg.chat.id), message_id: String(msg.message_id) });

// The Telegram text or caption as Discord markdown, after any media placeholder.
const discordContent = (msg: TelegramMessage, media: TelegramMedia | undefined): string => {
    const formatted: Formatted = msg.text ? { text: msg.text, entities: msg.entities ?? [] } : media?.caption ?? { text: '', entities: [] };
    return [media?.placeholder, toDiscordMarkdown(formatted)].filter(Boolean).join(' ');
};

// cleanContent has user and channel mentions spelled out as names, for Telegram.
const discordTexts = (message: DiscordMessage): { telegram: Formatted; discord: string } => {
    const placeholders: string[] = discordMedia(message).placeholders;
    const text: string = [...placeholders, message.cleanContent].filter(Boolean).join(' ');
    return {
        telegram: text ? fmt`${bold(`${message.author.username}:`)} ${text}` : bold(`${message.author.username}:`),
        discord: [...placeholders, message.content].filter(Boolean).join(' ')
    };
};

// The original's copies, for an edit or deletion of a message that was relayed from here.
const copiesOf = async (ref: MessageRef): Promise<{ original: RelayedMessage; copies: RelayedMessage[] } | undefined> => {
    const original: RelayedMessage | undefined = await relayedDao.find(ref);
    return original?.kind === 'origin' ? { original, copies: (await relayedDao.group(original)).slice(1) } : undefined;
};

const editDiscordCopies = async (discord: DiscordService, telegram_chat_id: number, author: string, copies: RelayedMessage[], content: string): Promise<void> => {
    const links: ChatLink[] = await chatLinkDao.getLinks(telegram_chat_id);
    await Promise.all(copies.filter(copy => copy.platform === 'discord').map(copy => {
        const link: ChatLink | undefined = links.find(l => l.discord_channel_id === copy.chat_id);
        return link && discord.editRelayed(link, copy.message_id, copy.kind as CopyKind, author, content)
            .catch((err: Error) => console.error(`Could not edit relayed message ${copy.message_id} in Discord channel ${copy.chat_id}:`, err));
    }));
};

export const relayTelegramEdit = async (msg: TelegramMessage): Promise<void> => {
    const discord: DiscordService | null = DiscordService.instance;
    const relayed = discord ? await copiesOf(telegramRef(msg)) : undefined;
    if (!discord || !relayed) {
        return;
    }
    await editDiscordCopies(discord, msg.chat.id, relayed.original.author ?? telegramName(msg.from), relayed.copies, discordContent(msg, telegramMedia(msg)));
};

export const relayDiscordEdit = async (bot: Bot, edited: DiscordMessage | PartialMessage, link: ChatLink): Promise<void> => {
    const discord: DiscordService | null = DiscordService.instance;
    const relayed = discord ? await copiesOf({ platform: 'discord', chat_id: edited.channelId, message_id: edited.id }) : undefined;
    if (!discord || !relayed) {
        return;
    }
    const message: DiscordMessage = edited.partial ? await edited.fetch() : edited;
    const texts = discordTexts(message);
    await Promise.all(relayed.copies.filter(copy => copy.platform === 'telegram').map(copy => {
        const target = { chat_id: Number(copy.chat_id), message_id: Number(copy.message_id) };
        const edit: Promise<unknown> = copy.kind === 'text'
            ? bot.api.editMessageText({ ...target, ...messageText(texts.telegram) })
            : copy.kind === 'caption'
                ? bot.api.editMessageCaption({ ...target, caption: texts.telegram.text, caption_entities: texts.telegram.entities })
                : Promise.resolve();
        return edit.catch((err: Error) => console.error(`Could not edit relayed message ${copy.message_id} in Telegram chat ${copy.chat_id}:`, err));
    }));
    await editDiscordCopies(discord, link.telegram_chat_id, message.author.username, relayed.copies, texts.discord);
};

export const relayFromDiscord = async (bot: Bot, message: DiscordMessage, link: ChatLink): Promise<void> => {
    const discord: DiscordService | null = DiscordService.instance;
    if (!discord) {
        return;
    }
    const media = discordMedia(message);
    if (!message.content && media.files.length === 0 && media.placeholders.length === 0) {
        return;
    }
    const author: string = message.author.username;
    const texts = discordTexts(message);

    const downloads = await Promise.all(media.files.map(async file => {
        try {
            return { file: await downloadUrl(file.url, file.name, file.contentType), kind: file.kind };
        } catch (err) {
            console.error(`Could not download Discord attachment ${file.url}:`, err);
            return undefined;
        }
    }));
    const downloaded: { file: RelayFile; kind: TelegramSendKind }[] = downloads.filter((d): d is { file: RelayFile; kind: TelegramSendKind } => d !== undefined);
    const files: RelayFile[] = downloaded.map(d => d.file);

    const copies: Copy[] = [];
    const telegramCopy = (message_id: number, kind: CopyKind): Copy =>
        ({ platform: 'telegram', chat_id: String(link.telegram_chat_id), message_id: String(message_id), kind });
    try {
        // The text rides as the first file's caption when it fits.
        let caption: Formatted | undefined = texts.telegram;
        if (files.length === 0 || texts.telegram.text.length > TELEGRAM_CAPTION_LIMIT) {
            const sent = await bot.api.sendMessage({ chat_id: link.telegram_chat_id, ...messageText(texts.telegram) });
            copies.push(telegramCopy(sent.message_id, 'text'));
            caption = files.length > 0 ? bold(`${author}:`) : undefined;
        }
        await downloaded.reduce<Promise<unknown>>((sending, { file, kind }, i) => sending
            .then(() => sendTelegramFile(bot, link.telegram_chat_id, kind, file, i === 0 ? caption : bold(`${author}:`)))
            .then(message_id => copies.push(telegramCopy(message_id, i === 0 && caption === texts.telegram ? 'caption' : 'extra'))), Promise.resolve());
    } catch (err) {
        console.error(`Could not relay Discord message ${message.id} to Telegram chat ${link.telegram_chat_id}:`, err);
    }

    const others: ChatLink[] = (await chatLinkDao.getLinks(link.telegram_chat_id))
        .filter(other => other.discord_channel_id !== link.discord_channel_id);
    const discordCopies = await Promise.all(others.map(other => discord.relay(other, author, texts.discord, files)
        .then(sent => ({ platform: 'discord' as const, chat_id: other.discord_channel_id, ...sent }))
        .catch((err: Error) => {
            console.error(`Could not relay Discord message ${message.id} to Discord channel ${other.discord_channel_id}:`, err);
            return undefined;
        })));
    await relayedDao.record({ platform: 'discord', chat_id: message.channelId, message_id: message.id }, author, [...copies, ...discordCopies.filter(isDefined)]);
};
