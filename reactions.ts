import { Bot, MessageReactionUpdated, ReactionType } from 'node-telegram-bot-api';
import DiscordService from './discord/DiscordService.js';
import RelayedMessageDAO, { MessageRef, RelayedMessage } from './dao/RelayedMessageDAO.js';
import RelayedReactionDAO from './dao/RelayedReactionDAO.js';

// The emoji bots may react with on Telegram (https://core.telegram.org/bots/api#reactiontypeemoji).
const TELEGRAM_REACTIONS: Set<string> = new Set([
    '❤', '👍', '👎', '🔥', '🥰', '👏', '😁', '🤔', '🤯', '😱', '🤬', '😢', '🎉', '🤩', '🤮', '💩', '🙏', '👌', '🕊',
    '🤡', '🥱', '🥴', '😍', '🐳', '❤‍🔥', '🌚', '🌭', '💯', '🤣', '⚡', '🍌', '🏆', '💔', '🤨', '😐', '🍓', '🍾', '💋',
    '🖕', '😈', '😴', '😭', '🤓', '👻', '👨‍💻', '👀', '🎃', '🙈', '😇', '😨', '🤝', '✍', '🤗', '🫡', '🎅', '🎄', '☃',
    '💅', '🤪', '🗿', '🆒', '💘', '🙉', '🦄', '😘', '💊', '🙊', '😎', '👾', '🤷‍♂', '🤷', '🤷‍♀', '😡'
]);

// Discord only accepts these with the emoji presentation selector, which Telegram leaves out.
const DISCORD_FORMS: Record<string, string> = {
    '❤': '❤️', '❤‍🔥': '❤️‍🔥', '🕊': '🕊️', '✍': '✍️', '☃': '☃️', '🤷‍♂': '🤷‍♂️', '🤷‍♀': '🤷‍♀️'
};

// Reactions are stored in their Discord form.
export const discordEmoji = (telegram: string): string => DISCORD_FORMS[telegram] ?? telegram;

export const telegramEmoji = (discord: string): string | undefined => {
    const emoji = discord.replace(/️/g, '');
    return TELEGRAM_REACTIONS.has(emoji) ? emoji : undefined;
};

export interface ReactionChange {
    ref: MessageRef;
    user_ref: string;
    added: string[];
    removed: string[];
}

// Custom and paid reactions have no counterpart on Discord.
const emojiOf = (reactions: ReactionType[]): string[] =>
    reactions.flatMap(reaction => 'emoji' in reaction ? [discordEmoji(reaction.emoji)] : []);

export const telegramReactionChange = (update: MessageReactionUpdated): ReactionChange | undefined => {
    const reactor = update.user ?? update.actor_chat;
    if (!reactor || update.user?.is_bot) {
        return undefined;
    }
    const before = emojiOf(update.old_reaction);
    const after = emojiOf(update.new_reaction);
    return {
        ref: { platform: 'telegram', chat_id: String(update.chat.id), message_id: String(update.message_id) },
        user_ref: `telegram:${reactor.id}`,
        added: after.filter(e => !before.includes(e)),
        removed: before.filter(e => !after.includes(e))
    };
};

// Each copy of a relayed message shows the reactions from the others: every emoji on Discord, where
// the bot adds its own reaction, and only the most used one on Telegram, where a bot gets one.
class ReactionMirror {
    private messages: RelayedMessageDAO = new RelayedMessageDAO();
    private reactions: RelayedReactionDAO = new RelayedReactionDAO();

    constructor(private bot: Bot) {}

    async apply(change: ReactionChange): Promise<void> {
        const message: RelayedMessage | undefined = await this.messages.find(change.ref);
        if (!message || (change.added.length === 0 && change.removed.length === 0)) {
            return;
        }
        await this.reactions.add(message.id, change.user_ref, change.added);
        await this.reactions.remove(message.id, change.user_ref, change.removed);
        const group: RelayedMessage[] = await this.messages.group(message);
        await Promise.all(group
            .filter(target => target.id !== message.id && target.kind !== 'extra')
            .map(target => this.reflect(group[0].id, target, change)
                .catch((err: Error) => console.error(`Could not mirror reactions onto ${target.platform} message ${target.message_id}:`, err))));
    }

    private async reflect(origin_id: number, target: RelayedMessage, change: ReactionChange): Promise<void> {
        const shown: string[] = await this.reactions.elsewhere(origin_id, target.id);
        if (target.platform === 'telegram') {
            const top: string | undefined = shown.map(telegramEmoji).find(e => e !== undefined);
            await this.bot.api.setMessageReaction({
                chat_id: Number(target.chat_id),
                message_id: Number(target.message_id),
                reaction: top ? [{ type: 'emoji', emoji: top }] : []
            });
            return;
        }
        const discord: DiscordService | null = DiscordService.instance;
        await Promise.all([
            ...change.added.filter(e => shown.includes(e)).map(e => discord?.setOwnReaction(target.chat_id, target.message_id, e, true)),
            ...change.removed.filter(e => !shown.includes(e)).map(e => discord?.setOwnReaction(target.chat_id, target.message_id, e, false))
        ]);
    }
}

export default ReactionMirror;
