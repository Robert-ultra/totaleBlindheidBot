import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import ScheduleDAO from '../dao/ScheduleDAO.js';
import { cancelScheduledRollcall } from '../command/cancel.js';

afterEach(() => mock.restoreAll());

test('cancelling removes the schedule and says so', async () => {
    const calls: unknown[][] = [];
    mock.method(ScheduleDAO.prototype, 'removeScheduledRollcall', async (chat_id: number) => {
        calls.push(['remove', chat_id]);
    });
    const bot = { api: { sendMessage: async (message: { text: string }) => calls.push(['send', message.text]) } } as unknown as Bot;
    await cancelScheduledRollcall(bot, { chat_id: -7 }, { time: new Date('2026-11-11T20:00:00Z') }, 'Cancelled.');
    assert.deepEqual(calls, [['remove', -7], ['send', 'Cancelled.']]);
});
