import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import ScheduleDAO, { ScheduledRollcalls } from '../dao/ScheduleDAO.js';
import RollcallScheduler from '../RollcallScheduler.js';
import { Recurrence } from '../timeUtils.js';

const now = new Date('2026-11-11T20:00:00Z');
const bot = {} as Bot;
const wednesdays = new Recurrence(3, 20, 0, 'UTC');

const fixture = (schedules: ScheduledRollcalls, failure?: Error) => {
    const calls: unknown[][] = [];
    const scheduleDao = {
        getScheduledRollcalls: async () => schedules,
        removeScheduledRollcall: async (chat_id: number) => {
            calls.push(['remove', chat_id]);
        },
        updateScheduledRollcall: async (chat_id: number, time: Date, rsvp_id?: number) => {
            calls.push(['update', chat_id, time.toISOString(), rsvp_id]);
        }
    } as unknown as ScheduleDAO;
    const fire = async (_bot: Bot, chat_id: number, rsvp_id?: number) => {
        calls.push(['fire', chat_id, rsvp_id]);
        if (failure) {
            throw failure;
        }
    };
    const confirm = async (_bot: Bot, chat_id: number, time: Date, recurrence: Recurrence) => {
        calls.push(['confirm', chat_id, time.toISOString(), recurrence.describe()]);
        return 41;
    };
    return { calls, scheduler: new RollcallScheduler(bot, scheduleDao, fire, confirm) };
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

test('a due weekly schedule fires and moves to next week without an RSVP list', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: now, rsvp_id: 40, recurrence: wednesdays } });
    await scheduler.tick(now);
    assert.deepEqual(calls, [['fire', -7, 40], ['update', -7, '2026-11-18T20:00:00.000Z', undefined]]);
});

test('a weekly schedule whose rollcall fails still moves to next week', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: now, recurrence: wednesdays } }, new Error('telegram down'));
    await scheduler.tick(now);
    assert.deepEqual(calls.at(-1), ['update', -7, '2026-11-18T20:00:00.000Z', undefined]);
});

test('a weekly schedule within 12 hours gets its confirmation and RSVP list', async () => {
    const time = new Date('2026-11-12T08:00:00Z');
    const { calls, scheduler } = fixture({ '-7': { time, recurrence: wednesdays } });
    await scheduler.tick(now);
    assert.deepEqual(calls, [['confirm', -7, time.toISOString(), 'every Wednesday at 20:00'], ['update', -7, time.toISOString(), 41]]);
});

test('a weekly schedule further out, or already confirmed, is left alone', async () => {
    const { calls, scheduler } = fixture({
        '-7': { time: new Date('2026-11-12T08:01:00Z'), recurrence: wednesdays },
        '-8': { time: new Date('2026-11-11T21:00:00Z'), rsvp_id: 40, recurrence: wednesdays }
    });
    await scheduler.tick(now);
    assert.deepEqual(calls, []);
});

test('a chat still being handled is skipped by an overlapping check', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: now, recurrence: wednesdays } });
    await Promise.all([scheduler.tick(now), scheduler.tick(now)]);
    assert.equal(calls.filter(call => call[0] === 'fire').length, 1);
});
