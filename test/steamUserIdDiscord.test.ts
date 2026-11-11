import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import UserDAO from '../dao/UserDAO.js';
import steamUserId from '../command/steam_user_id.js';

const SPECIFY_IDS = 'Please specify your Steam user ID(s) as SteamID64 (the 17-digit number starting with 7656), separated by commas if multiple.';

const run = async (argument: string): Promise<{ replies: unknown[]; saved: unknown[][] }> => {
    const replies: unknown[] = [];
    const set = mock.method(UserDAO.prototype, 'setSteamUserId', async () => undefined);
    const cmd: Command = {
        platform: 'discord',
        chat_id: 1,
        user: { id: 7 },
        command: { name: 'steam_user_id', argument, argumentTokens: argument.split(' '), options: {} },
        reply: async text => replies.push(text),
        replyPrivately: async () => undefined
    };
    await steamUserId({} as Bot, cmd);
    const saved = set.mock.calls.map(call => call.arguments);
    set.mock.restore();
    return { replies, saved };
};

test('a Discord user sets their own Steam IDs', async () => {
    assert.deepEqual(await run('76561198000000001, 76561198000000002'), {
        replies: ['Your Steam user ID(s) has been set to 76561198000000001, 76561198000000002'],
        saved: [[7, ['76561198000000001', '76561198000000002']]]
    });
});

test('invalid or missing IDs from Discord are rejected without saving', async () => {
    assert.deepEqual(await run('123'), { replies: [SPECIFY_IDS], saved: [] });
    assert.deepEqual(await run(''), { replies: [SPECIFY_IDS], saved: [] });
});
