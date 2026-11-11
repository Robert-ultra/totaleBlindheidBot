import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import RsvpDAO, { RsvpEntry, RsvpList } from '../dao/RsvpDAO.js';
import RollcallPlayerDAO from '../dao/RollcallPlayerDAO.js';
import ChatDAO from '../dao/ChatDAO.js';
import { ScheduledRollcall } from '../dao/ScheduleDAO.js';
import RollcallReminder from '../RollcallReminder.js';

const bot = {} as Bot;
const now = new Date('2026-11-11T20:00:00Z');
const schedule: ScheduledRollcall = { time: new Date('2026-11-11T20:12:00Z'), rsvp_id: 40 };

const entry = (user_id: number, name: string, rsvp: RsvpEntry['rsvp']): RsvpEntry => ({ user_id, name, rsvp });

const fixture = (entries: RsvpEntry[], autoCancel: boolean, created_at: Date = new Date('2026-11-11T17:00:00Z')) => {
    const rotation: string[] = ['[Ann](user:1)', '[Bob](user:2)', '[Cid](user:3)'];
    const calls: unknown[][] = [];
    const list: RsvpList = { rsvp_id: 40, chat_id: -7, entries: Object.fromEntries(entries.map(e => [String(e.user_id), e])), messages: [], created_at };
    const rsvpDao = { getRsvpList: async (rsvp_id: number) => rsvp_id === 40 ? list : undefined } as unknown as RsvpDAO;
    const rosterDao = { getRollcallPlayerUsernames: async () => rotation } as unknown as RollcallPlayerDAO;
    const chatDao = { isAutoCancel: async () => autoCancel } as unknown as ChatDAO;
    const cancel = async (_bot: Bot, chat_id: number, cancelled: ScheduledRollcall, text: string) => calls.push(['cancel', chat_id, cancelled.rsvp_id, text]);
    const ping = async (_bot: Bot, chat_id: number, text: string, tags: string[]) => calls.push(['ping', chat_id, text, tags]);
    return { calls, reminder: new RollcallReminder(rsvpDao, rosterDao, chatDao, cancel, ping) };
};

test('the reminder pings maybes and rotation players who did not answer', async () => {
    const { calls, reminder } = fixture([entry(1, 'Ann', 'yes'), entry(2, 'Bob', 'no'), entry(9, 'Mia', 'maybe'), entry(8, 'Kit', 'yes')], false);
    await reminder.remind(bot, -7, schedule, now);
    assert.deepEqual(calls, [['ping', -7, 'Rollcall in 12 minutes! Still waiting on: ', ['[Cid](user:3)', '[Mia](user:9)']]]);
});

test('nobody is pinged when everyone answered', async () => {
    const { calls, reminder } = fixture([entry(1, 'Ann', 'yes'), entry(2, 'Bob', 'no'), entry(3, 'Cid', 'yes')], false);
    await reminder.remind(bot, -7, schedule, now);
    assert.deepEqual(calls, []);
});

test('with auto-cancel on, a rollcall short of a full lobby is cancelled instead', async () => {
    const { calls, reminder } = fixture([entry(1, 'Ann', 'yes'), entry(9, 'Mia', 'maybe')], true);
    await reminder.remind(bot, -7, schedule, now);
    assert.deepEqual(calls, [['cancel', -7, 40, 'Rollcall cancelled: only 1 of 5 said yes.']]);
});

test('with auto-cancel on, a full lobby still gets its reminder', async () => {
    const { calls, reminder } = fixture([1, 2, 3, 4, 5].map(id => entry(id, `P${id}`, 'yes')).concat(entry(9, 'Mia', 'maybe')), true);
    await reminder.remind(bot, -7, schedule, now);
    assert.deepEqual(calls, [['ping', -7, 'Rollcall in 12 minutes! Still waiting on: ', ['[Mia](user:9)']]]);
});

test('a rollcall confirmed within the reminder window is not reminded or cancelled', async () => {
    const { calls, reminder } = fixture([entry(9, 'Mia', 'maybe')], true, new Date('2026-11-11T19:57:00Z'));
    await reminder.remind(bot, -7, schedule, now);
    assert.deepEqual(calls, []);
});

test('a schedule whose RSVP list is gone is left alone', async () => {
    const { calls, reminder } = fixture([], true);
    await reminder.remind(bot, -7, { time: schedule.time, rsvp_id: 41 }, now);
    await reminder.remind(bot, -7, { time: schedule.time }, now);
    assert.deepEqual(calls, []);
});
