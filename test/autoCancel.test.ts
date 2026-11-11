import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../MessageRouter.js';
import ChatDAO from '../dao/ChatDAO.js';
import autoCancel from '../command/auto_cancel.js';

const run = async (argument: string, status: string): Promise<{ replies: unknown[]; saved: unknown[][] }> => {
    const saved: unknown[][] = [];
    mock.method(ChatDAO.prototype, 'setAutoCancel', async (...args: unknown[]) => {
        saved.push(args);
    });
    const replies: unknown[] = [];
    const bot = { api: { getChatMember: async () => ({ status }) } } as unknown as Bot;
    await autoCancel(bot, {
        chat: { id: -7 },
        from: { id: 11 },
        command: { name: 'auto_cancel', argument, argumentTokens: [argument] },
        reply: async (text: unknown) => replies.push(text)
    } as unknown as ExtendedMessage);
    return { replies, saved };
};

afterEach(() => mock.restoreAll());

test('an admin turns auto-cancel on and off', async () => {
    assert.deepEqual(await run('on', 'administrator'), { replies: ['Auto-cancel for this chat has been turned on.'], saved: [[-7, true]] });
    mock.restoreAll();
    assert.deepEqual(await run('OFF', 'creator'), { replies: ['Auto-cancel for this chat has been turned off.'], saved: [[-7, false]] });
});

test('anyone else is turned away', async () => {
    assert.deepEqual(await run('on', 'member'), { replies: ['Only a group admin can change auto-cancel.'], saved: [] });
});

test('anything but on or off gets the usage', async () => {
    assert.deepEqual(await run('maybe', 'administrator'), { replies: ['Usage: /auto_cancel on|off'], saved: [] });
});
