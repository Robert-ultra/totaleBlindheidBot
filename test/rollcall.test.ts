import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import UserDAO from '../dao/UserDAO.js';
import RollcallPlayerDAO from '../dao/RollcallPlayerDAO.js';
import ScheduleDAO from '../dao/ScheduleDAO.js';
import { bold, Part } from '../format.js';
import rollcall from '../command/rollcall.js';

const bot = {} as Bot;

const run = async (argument: string): Promise<{ replies: Part[]; scheduled: boolean }> => {
    const timezone = mock.method(UserDAO.prototype, 'getUserTimezone', async () => 'UTC');
    // Failing the rotation lookup stops a rollcall before it posts anything.
    mock.method(RollcallPlayerDAO.prototype, 'getRollcallPlayerUsernames', async () => {
        throw new Error('rollcall ran');
    });
    const replies: Part[] = [];
    await rollcall(bot, {
        platform: 'telegram',
        chat_id: -9,
        user: { id: 1 },
        command: { name: 'rollcall', argument, argumentTokens: argument.split(' ').filter(Boolean) },
        reply: async (text: Part) => replies.push(text)
    } as Command);
    return { replies, scheduled: timezone.mock.callCount() > 0 };
};

afterEach(() => mock.restoreAll());

test('/rollcall without an argument runs a rollcall', async () => {
    assert.deepEqual(await run(''), { replies: [bold('Error: rollcall ran')], scheduled: false });
});

test('/rollcall followed by text that is not a time runs a rollcall', async () => {
    assert.deepEqual(await run('lets go'), { replies: [bold('Error: rollcall ran')], scheduled: false });
});

test('/rollcall followed by a time is handled as /schedule', async () => {
    assert.deepEqual(await run('1 minute'), { replies: ['Rollcall must be scheduled at least 2 minutes in advance.'], scheduled: true });
    mock.restoreAll();
    assert.deepEqual(await run('13 hours'), { replies: ['Rollcall cannot be scheduled more than 12 hours in advance.'], scheduled: true });
});

test('/rollcall followed by a weekly time is handled as /schedule', async () => {
    mock.method(ScheduleDAO.prototype, 'getScheduledRollcalls', async () => {
        throw new Error('scheduled');
    });
    const { replies, scheduled } = await run('every thursday 21:00');
    assert.equal(scheduled, true);
    assert.match(String(replies[0]), /^Error: scheduled/);
});
