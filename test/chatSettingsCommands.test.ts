import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import GithubDAO from '../dao/GithubDAO.js';
import ChatDAO from '../dao/ChatDAO.js';
import { Part } from '../format.js';
import githubNotify from '../command/github_notify.js';
import steamUpdates from '../command/steam_updates.js';

const bot = {} as Bot;

const discordCommand = (argument: string, replies: Part[]): Command => ({
    platform: 'discord',
    chat_id: -9,
    user: { id: 1 },
    command: { name: 'x', argument, argumentTokens: argument ? [argument] : [], options: {} },
    reply: async (text: Part) => replies.push(text),
    replyPrivately: async () => undefined
});

afterEach(() => mock.restoreAll());

test('/github_notify from Discord sets the linked group\'s notifications, and waits for the reply', async () => {
    const saved = mock.method(GithubDAO.prototype, 'setGithubNotify', async () => undefined);
    const replies: Part[] = [];
    await githubNotify(bot, discordCommand('OFF', replies));
    assert.deepEqual(saved.mock.calls.map(call => call.arguments), [[-9, false]]);
    assert.deepEqual(replies, ['GitHub notifications for this chat have been turned off.']);
});

test('/steam_updates from Discord sets the linked group\'s updates, and waits for the reply', async () => {
    const saved = mock.method(ChatDAO.prototype, 'setChatSettings', async () => undefined);
    const replies: Part[] = [];
    await steamUpdates(bot, discordCommand('on', replies));
    assert.deepEqual(saved.mock.calls.map(call => call.arguments), [[-9, { steam_updates: true }]]);
    assert.deepEqual(replies, ['Steam updates for this chat have been turned on.']);
});

test('the chat settings commands ask for on or off', async () => {
    const replies: Part[] = [];
    await githubNotify(bot, discordCommand('maybe', replies));
    await steamUpdates(bot, discordCommand('', replies));
    assert.deepEqual(replies, [
        'Please specify "on" or "off" to enable or disable GitHub notifications for this chat.',
        'Please specify "on" or "off" to enable or disable Steam updates for this chat.'
    ]);
});
