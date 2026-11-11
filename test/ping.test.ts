import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import UserDAO from '../dao/UserDAO.js';
import { pingTags } from '../ping.js';

afterEach(() => mock.restoreAll());

test('pinging sends the text followed by the tags', async () => {
    mock.method(UserDAO.prototype, 'getUsers', async () => ({ 1: { id: 1, telegram_id: 501 } }));
    const sent: unknown[] = [];
    const bot = { api: { sendMessage: async (message: unknown) => sent.push(message) } } as unknown as Bot;
    await pingTags(bot, -7, 'Still waiting on: ', ['[Ann](user:1)', 'Dave']);
    assert.equal(sent.length, 1);
    const message = sent[0] as { chat_id: number; text: string; entities?: { type: string; url?: string }[] };
    assert.equal(message.chat_id, -7);
    assert.equal(message.text, 'Still waiting on: Ann Dave');
    assert.deepEqual(message.entities?.map(entity => entity.url), ['tg://user?id=501']);
});
