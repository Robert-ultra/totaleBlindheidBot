import { Bot } from 'node-telegram-bot-api';
import { asFormatted, Formatted } from './format.js';
import { mentionUsers, withTags } from './presence.js';
import { withDiscordTags } from './discord/render.js';
import { broadcast, Broadcast } from './messenger.js';

// Sends `text` followed by the tags, pinging each person wherever they can be reached.
export const pingTags = async (bot: Bot, chat_id: number, text: string, tags: string[]): Promise<Broadcast> => {
    const head: Formatted = asFormatted(text);
    const users = await mentionUsers(tags);
    return broadcast(bot, { chat_id }, withTags(head, tags, users), withDiscordTags(head, tags, users));
};
