import { User } from '../dao/UserDAO.js';
import { Formatted } from '../format.js';
import { parseMention } from '../mention.js';
import { Rsvp } from '../dao/RsvpDAO.js';
import { renderLists } from '../rsvp.js';
import { toDiscordMarkdown } from './markdown.js';

const discordMention = (mention: string, users: Record<number, User>): string => {
    const parsed = parseMention(mention);
    const user: User | undefined = parsed.id !== undefined
        ? users[parsed.id]
        : Object.values(users).find(u => u.username !== undefined && u.username.toLowerCase() === parsed.username?.toLowerCase());
    const discord_id: string | undefined = user?.discord_id;
    return discord_id !== undefined ? `<@${discord_id}>` : toDiscordMarkdown({ text: parsed.display, entities: [] });
};

export const withDiscordTags = (head: Formatted, tags: string[], users: Record<number, User>): string =>
    `${toDiscordMarkdown(head)}${tags.map(tag => discordMention(tag, users)).join(' ')}`;

export const renderDiscordMessage = (base: string, groups: Record<Rsvp, string[]>): string => {
    const lists: string = renderLists(groups);
    return lists ? `${base}\n\n${toDiscordMarkdown({ text: lists, entities: [] })}` : base;
};
