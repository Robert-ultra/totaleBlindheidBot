import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import ScheduleDAO, { ScheduledRollcalls } from '../dao/ScheduleDAO.js';
import RollcallScheduler from '../RollcallScheduler.js';

const now = new Date('2026-11-11T20:00:00Z');
const bot = {} as Bot;

const fixture = (schedules: ScheduledRollcalls, failure?: Error) => {
    const calls: unknown[][] = [];
    const scheduleDao = {
        getScheduledRollcalls: async () => schedules,
        removeScheduledRollcall: async (chat_id: number) => {
            calls.push(['remove', chat_id]);
        }
    } as unknown as ScheduleDAO;
    const fire = async (_bot: Bot, chat_id: number, rsvp_id?: number) => {
        calls.push(['fire', chat_id, rsvp_id]);
        if (failure) {
            throw failure;
        }
    };
    return { calls, scheduler: new RollcallScheduler(bot, scheduleDao, fire) };
};

test('a due schedule fires its rollcall on its RSVP list and is removed', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: new Date('2026-11-11T19:59:00Z'), rsvp_id: 40 } });
    await scheduler.tick(now);
    assert.deepEqual(calls, [['fire', -7, 40], ['remove', -7]]);
});

test('a schedule that is not due yet is left alone', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: new Date('2026-11-11T20:01:00Z'), rsvp_id: 40 } });
    await scheduler.tick(now);
    assert.deepEqual(calls, []);
});

test('a schedule whose rollcall fails is still removed', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: now } }, new Error('telegram down'));
    await scheduler.tick(now);
    assert.deepEqual(calls, [['fire', -7, undefined], ['remove', -7]]);
});
