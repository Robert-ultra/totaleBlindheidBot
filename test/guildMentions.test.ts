import { test } from 'node:test';
import assert from 'node:assert/strict';
import GuildMentions, { MemberLookup } from '../discord/GuildMentions.js';

const MEMBERS: Record<string, string[]> = { '1': ['100000000000000001', '100000000000000002'], '2': ['100000000000000002'] };
const NAMES: Record<string, string> = { '100000000000000001': 'Bea_x', '100000000000000002': 'Dan' };

const lookup: MemberLookup = {
    isMember: async (guild_id: string, user_id: string) => MEMBERS[guild_id]?.includes(user_id) ?? false,
    displayName: async (user_id: string) => NAMES[user_id]
};

const mentions = new GuildMentions(lookup);

test('a tag of a member of the server stays a tag', async () => {
    assert.equal(await mentions.forGuild('<@100000000000000002> and <@!100000000000000002> hi', '2'), '<@100000000000000002> and <@100000000000000002> hi');
});

test('a tag of someone not on the server becomes their name', async () => {
    assert.equal(await mentions.forGuild('<@100000000000000001> hi', '2'), '@Bea\\_x hi');
    assert.equal(await mentions.forGuild('<@100000000000000001> hi', '1'), '<@100000000000000001> hi');
});

test('a tag of an unknown user stays as it is', async () => {
    assert.equal(await mentions.forGuild('<@100000000000000009> hi', '2'), '<@100000000000000009> hi');
});

test('content without tags is untouched', async () => {
    assert.equal(await mentions.forGuild('**gg** <#100000000000000005>', '2'), '**gg** <#100000000000000005>');
});
