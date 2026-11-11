import { DISCORD_USER_MENTION, toDiscordMarkdown } from './markdown.js';

export interface MemberLookup {
    isMember(guild_id: string, user_id: string): Promise<boolean>;
    displayName(user_id: string): Promise<string | undefined>;
}

// Discord can neither show nor ping a tagged user outside their servers, so there they get their name.
class GuildMentions {
    private readonly lookup: MemberLookup;

    constructor(lookup: MemberLookup) {
        this.lookup = lookup;
    }

    async forGuild(content: string, guild_id: string): Promise<string> {
        const parts: string[] = await Promise.all(content.split(DISCORD_USER_MENTION)
            .map((part, i) => i % 2 === 0 ? part : this.mention(part, guild_id)));
        return parts.join('');
    }

    private async mention(user_id: string, guild_id: string): Promise<string> {
        if (await this.lookup.isMember(guild_id, user_id)) {
            return `<@${user_id}>`;
        }
        const name: string | undefined = await this.lookup.displayName(user_id);
        return name === undefined ? `<@${user_id}>` : toDiscordMarkdown({ text: `@${name}`, entities: [] });
    }
}

export default GuildMentions;
