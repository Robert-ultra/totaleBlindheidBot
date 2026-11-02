import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import ChatLinkDAO from '../dao/ChatLinkDAO.js';
import RelayedMessageDAO, { RelayedMessage } from '../dao/RelayedMessageDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { bold, fmt } from '../format.js';
import { Broadcast, editDiscordCopies, editMirrored, rememberCopies, sendMirrored } from '../messenger.js';

const text = fmt`${bold('Ann')} is playing`;

const fakeBot = (calls: unknown[], fail = false): Bot => ({
    api: {
        sendMessage: async (params: unknown) => {
            calls.push(['sendMessage', params]);
            return { message_id: 50 };
        },
        editMessageText: async (params: unknown) => {
            calls.push(['editMessageText', params]);
            if (fail) {
                throw new Error('message to edit not found');
            }
            return true;
        }
    }
} as unknown as Bot);

const fakeDiscord = (calls: unknown[]): DiscordService => ({
    sendAsBot: async (channel_id: string, content: string) => {
        calls.push(['sendAsBot', channel_id, content]);
        if (channel_id === 'gone') {
            throw new Error('Unknown Channel');
        }
        return `copy-in-${channel_id}`;
    },
    editMessage: async (channel_id: string, message_id: string, content: string) => {
        calls.push(['editMessage', channel_id, message_id, content]);
    }
} as unknown as DiscordService);

const relayed = (fields: Partial<RelayedMessage>): RelayedMessage =>
    ({ id: 1, origin_id: null, kind: 'origin', author: 'Steam', platform: 'telegram', chat_id: '-7', message_id: '50', ...fields });

afterEach(() => {
    mock.restoreAll();
    DiscordService.instance = null;
});

test('a mirrored message goes to every linked channel and its copies are remembered', async () => {
    const calls: unknown[] = [];
    DiscordService.instance = fakeDiscord(calls);
    mock.method(ChatLinkDAO.prototype, 'getLinks', async () => [{ discord_channel_id: 'a' }, { discord_channel_id: 'gone' }, { discord_channel_id: 'b' }]);
    const record = mock.method(RelayedMessageDAO.prototype, 'record', async () => undefined);

    const sent = await sendMirrored(fakeBot(calls), -7, text, 'Steam');

    assert.equal(sent.message_id, 50);
    assert.deepEqual(calls.filter(call => (call as unknown[])[0] === 'sendAsBot'), [
        ['sendAsBot', 'a', '**Ann** is playing'],
        ['sendAsBot', 'gone', '**Ann** is playing'],
        ['sendAsBot', 'b', '**Ann** is playing']
    ]);
    assert.deepEqual(record.mock.calls.map(call => call.arguments), [[
        { platform: 'telegram', chat_id: '-7', message_id: '50' },
        'Steam',
        [
            { platform: 'discord', chat_id: 'a', message_id: 'copy-in-a', kind: 'bot' },
            { platform: 'discord', chat_id: 'b', message_id: 'copy-in-b', kind: 'bot' }
        ]
    ]]);
});

test('without Discord a mirrored message only goes to Telegram', async () => {
    const calls: unknown[] = [];
    const record = mock.method(RelayedMessageDAO.prototype, 'record', async () => undefined);

    await sendMirrored(fakeBot(calls), -7, text, 'Steam');

    assert.deepEqual(calls.map(call => (call as unknown[])[0]), ['sendMessage']);
    assert.equal(record.mock.callCount(), 0);
});

test('an edit reaches the remembered Discord copies', async () => {
    const calls: unknown[] = [];
    DiscordService.instance = fakeDiscord(calls);
    mock.method(RelayedMessageDAO.prototype, 'find', async () => relayed({}));
    mock.method(RelayedMessageDAO.prototype, 'group', async () => [
        relayed({}),
        relayed({ id: 2, origin_id: 1, kind: 'bot', platform: 'discord', chat_id: 'a', message_id: 'copy-in-a' })
    ]);

    await editMirrored(fakeBot(calls), -7, 50, text);

    assert.deepEqual(calls, [
        ['editMessageText', { text: 'Ann is playing', entities: [{ type: 'bold', offset: 0, length: 3 }], chat_id: -7, message_id: 50 }],
        ['editMessage', 'a', 'copy-in-a', '**Ann** is playing']
    ]);
});

test('a failed Telegram edit fails the call and leaves the copies alone', async () => {
    const calls: unknown[] = [];
    DiscordService.instance = fakeDiscord(calls);
    const find = mock.method(RelayedMessageDAO.prototype, 'find', async () => relayed({}));

    await assert.rejects(editMirrored(fakeBot(calls, true), -7, 50, text), /message to edit not found/);

    assert.equal(find.mock.callCount(), 0);
    assert.deepEqual(calls.map(call => (call as unknown[])[0]), ['editMessageText']);
});

test('a broadcast\'s Discord copies are remembered under its Telegram message', async () => {
    const record = mock.method(RelayedMessageDAO.prototype, 'record', async () => undefined);
    const sent = {
        telegram: { message_id: 50 },
        discord: [{ where: { platform: 'discord', channel_id: 'a', message_id: 'copy-in-a' } }]
    } as unknown as Broadcast;

    await rememberCopies(-7, sent, 'Ann');
    await rememberCopies(-7, { discord: sent.discord }, 'Ann');

    assert.deepEqual(record.mock.calls.map(call => call.arguments), [[
        { platform: 'telegram', chat_id: '-7', message_id: '50' },
        'Ann',
        [{ platform: 'discord', chat_id: 'a', message_id: 'copy-in-a', kind: 'bot' }]
    ]]);
});

test('Discord copies of a message not relayed are left alone', async () => {
    const calls: unknown[] = [];
    DiscordService.instance = fakeDiscord(calls);
    mock.method(RelayedMessageDAO.prototype, 'find', async () => undefined);

    await editDiscordCopies(-7, 50, 'Go!');

    assert.deepEqual(calls, []);
});
