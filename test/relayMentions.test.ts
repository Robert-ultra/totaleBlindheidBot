import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageEntity } from 'node-telegram-bot-api';
import UserDAO, { User } from '../dao/UserDAO.js';
import RelayMentions from '../RelayMentions.js';
import { bold, fmt } from '../format.js';

const ann: User = { id: 1, telegram_id: 11, name: 'Ann', username: 'ann_cs', discord_id: '100000000000000001' };
const bob: User = { id: 2, telegram_id: 22, name: 'Bob', username: 'bob' };
const kit: User = { id: 3, discord_id: '100000000000000003', discord_username: 'kit' };

const mentions = (): RelayMentions => {
    const users: User[] = [ann, bob, kit];
    mock.method(UserDAO.prototype, 'getUserIdByUsername', async (username: string) => users.find(user => user.username === username)?.id);
    mock.method(UserDAO.prototype, 'getUser', async (id: number) => users.find(user => user.id === id));
    mock.method(UserDAO.prototype, 'getUserByTelegramId', async (telegram_id: number) => users.find(user => user.telegram_id === telegram_id));
    mock.method(UserDAO.prototype, 'getUsersByDiscordIds', async (ids: string[]) =>
        Object.fromEntries(users.filter(user => user.discord_id !== undefined && ids.includes(user.discord_id)).map(user => [user.discord_id, user])));
    return new RelayMentions();
};

const usernameMention = (text: string, word: string): MessageEntity => ({ type: 'mention', offset: text.indexOf(word), length: word.length });

const tappedMention = (text: string, word: string, telegram_id: number): MessageEntity =>
    ({ type: 'text_mention', offset: text.indexOf(word), length: word.length, user: { id: telegram_id, is_bot: false, first_name: word } });

// Stands in for discord.js cleanContent, which spells out what Discord can resolve.
const clean = (text: string): string => text.replace(/<@!?(\d+)>/g, '@someone').replace(/<#(\d+)>/g, '#general');

afterEach(() => mock.restoreAll());

test('a typed @username of a linked user becomes a Discord mention', async () => {
    const text = '@ann_cs you coming?';
    assert.equal(await mentions().toDiscord({ text, entities: [usernameMention(text, '@ann_cs')] }), '<@100000000000000001> you coming?');
});

test('a tapped mention of a linked user becomes a Discord mention', async () => {
    const text = 'Ann you coming?';
    assert.equal(await mentions().toDiscord({ text, entities: [tappedMention(text, 'Ann', 11)] }), '<@100000000000000001> you coming?');
});

test('mentions of people without a Discord account stay text', async () => {
    const text = '@bob and @stranger_x and Bob';
    const entities: MessageEntity[] = [usernameMention(text, '@bob'), usernameMention(text, '@stranger_x'), tappedMention(text, 'Bob', 22)];
    assert.equal(await mentions().toDiscord({ text, entities }), '@bob and @stranger\\_x and Bob');
});

test('formatting around a translated mention is kept', async () => {
    const formatted = fmt`${bold('gg')} @ann_cs`;
    const text: string = formatted.text;
    assert.equal(await mentions().toDiscord({ text, entities: [...formatted.entities, usernameMention(text, '@ann_cs')] }), '**gg** <@100000000000000001>');
});

test('a Discord mention of a linked user becomes a Telegram tag', async () => {
    assert.deepEqual(await mentions().toTelegram('<@100000000000000001> and <@!100000000000000001> gg', clean), {
        text: '@Ann and @Ann gg',
        entities: [
            { type: 'text_link', offset: 0, length: 4, url: 'tg://user?id=11' },
            { type: 'text_link', offset: 9, length: 4, url: 'tg://user?id=11' }
        ]
    });
});

test('other Discord mentions are spelled out like before', async () => {
    assert.deepEqual(await mentions().toTelegram('<@100000000000000003> <@100000000000000009> in <#100000000000000005>', clean), {
        text: '@someone @someone in #general',
        entities: []
    });
});

test('linked and unlinked Discord mentions mix', async () => {
    assert.deepEqual(await mentions().toTelegram('hey <@100000000000000003>, <@100000000000000001> is here', clean), {
        text: 'hey @someone, @Ann is here',
        entities: [{ type: 'text_link', offset: 14, length: 4, url: 'tg://user?id=11' }]
    });
});

test('a message without mentions is only cleaned', async () => {
    assert.deepEqual(await mentions().toTelegram('see <#100000000000000005>', clean), { text: 'see #general', entities: [] });
});
