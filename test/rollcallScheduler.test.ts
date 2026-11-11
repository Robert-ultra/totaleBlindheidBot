import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import ScheduleDAO, { ScheduledRollcalls } from '../dao/ScheduleDAO.js';
import RollcallScheduler from '../RollcallScheduler.js';
import RollcallReminder from '../RollcallReminder.js';

const now = new Date('2026-11-11T20:00:00Z');
const bot = {} as Bot;

const fixture = (schedules: ScheduledRollcalls, failure?: Error) => {
    const calls: unknown[][] = [];
    const scheduleDao = {
        getScheduledRollcalls: async () => schedules,
        removeScheduledRollcall: async (chat_id: number) => {
            calls.push(['remove', chat_id]);
        },
        markReminded: async (chat_id: number) => {
            calls.push(['reminded', chat_id]);
        }
    } as unknown as ScheduleDAO;
    const fire = async (_bot: Bot, chat_id: number, rsvp_id?: number) => {
        calls.push(['fire', chat_id, rsvp_id]);
        if (failure) {
            throw failure;
        }
    };
    const reminder = {
        remind: async (_bot: Bot, chat_id: number, schedule: { rsvp_id?: number }) => {
            calls.push(['remind', chat_id, schedule.rsvp_id]);
            if (failure) {
                throw failure;
            }
        }
    } as unknown as RollcallReminder;
    return { calls, scheduler: new RollcallScheduler(bot, scheduleDao, fire, reminder) };
};

test('a due schedule fires its rollcall on its RSVP list and is removed', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: new Date('2026-11-11T19:59:00Z'), rsvp_id: 40 } });
    await scheduler.tick(now);
    assert.deepEqual(calls, [['fire', -7, 40], ['remove', -7]]);
});

test('a schedule that is not due yet is left alone', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: new Date('2026-11-11T20:16:00Z'), rsvp_id: 40 } });
    await scheduler.tick(now);
    assert.deepEqual(calls, []);
});

test('a schedule whose rollcall fails is still removed', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: now } }, new Error('telegram down'));
    await scheduler.tick(now);
    assert.deepEqual(calls, [['fire', -7, undefined], ['remove', -7]]);
});

test('a schedule within 15 minutes is marked reminded, then reminded', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: new Date('2026-11-11T20:15:00Z'), rsvp_id: 40 } });
    await scheduler.tick(now);
    assert.deepEqual(calls, [['reminded', -7], ['remind', -7, 40]]);
});

test('a schedule is reminded only once, not too early, and only with an RSVP list', async () => {
    const { calls, scheduler } = fixture({
        '-7': { time: new Date('2026-11-11T20:10:00Z'), rsvp_id: 40, reminded_at: now },
        '-8': { time: new Date('2026-11-11T20:15:01Z'), rsvp_id: 41 },
        '-9': { time: new Date('2026-11-11T20:10:00Z') }
    });
    await scheduler.tick(now);
    assert.deepEqual(calls, []);
});

test('a failing reminder does not stop the check', async () => {
    const { calls, scheduler } = fixture({ '-7': { time: new Date('2026-11-11T20:10:00Z'), rsvp_id: 40 } }, new Error('telegram down'));
    await scheduler.tick(now);
    assert.deepEqual(calls, [['reminded', -7], ['remind', -7, 40]]);
});
