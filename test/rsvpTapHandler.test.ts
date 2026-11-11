import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot, CallbackQuery } from 'node-telegram-bot-api';
import { ButtonInteraction, MessageFlags } from 'discord.js';
import RsvpDAO, { RsvpEntry, RsvpList } from '../dao/RsvpDAO.js';
import UserDAO from '../dao/UserDAO.js';
import { ChatLink } from '../dao/ChatLinkDAO.js';
import RsvpTapHandler from '../RsvpTapHandler.js';

const list: RsvpList = { rsvp_id: 40, chat_id: -7, entries: {}, messages: [], created_at: new Date() };

const fixture = (found: RsvpList | null = list, failure?: Error, updated: RsvpList | undefined = found ?? undefined) => {
    const calls: unknown[][] = [];
    const record = (name: string, result?: unknown) => async (...args: unknown[]) => {
        calls.push([name, ...args]);
        return result;
    };
    const rsvpDao = {
        getRsvpListByMessage: record('getRsvpListByMessage', found ?? undefined),
        getRsvpListByDiscordMessage: record('getRsvpListByDiscordMessage', found ?? undefined),
        getRsvpList: async () => found ?? undefined,
        setRsvpEntry: async (rsvp_id: number, entry: RsvpEntry) => {
            calls.push(['setRsvpEntry', rsvp_id, entry.user_id, entry.rsvp]);
            if (failure) {
                throw failure;
            }
            return updated;
        }
    } as unknown as RsvpDAO;
    const userDao = {
        fromTelegram: record('fromTelegram', { id: 3, name: 'Ann' }),
        fromDiscord: record('fromDiscord', { id: 4, discord_name: 'Kit' }),
        addUserChat: record('addUserChat')
    } as unknown as UserDAO;
    const bot = { api: { answerCallbackQuery: record('answerCallbackQuery') } } as unknown as Bot;
    const render = async (_bot: Bot, rsvp_id: number) => {
        calls.push(['render', rsvp_id]);
    };
    const ping = async (_bot: Bot, chat_id: number, text: string, people: RsvpEntry[]) => {
        calls.push(['ping', chat_id, text, people.map(person => person.name)]);
    };
    return { calls, handler: new RsvpTapHandler(bot, rsvpDao, userDao, render, ping) };
};

const query = (data: string): CallbackQuery => ({ id: 'q', data, from: { id: 11 }, message: { message_id: 50, chat: { id: -7 } } } as unknown as CallbackQuery);

const interaction = (customId: string, calls: unknown[][]): ButtonInteraction => ({
    customId,
    channelId: '900',
    message: { id: '901' },
    user: { id: '44', username: 'kit', globalName: 'Kit' },
    reply: async (options: unknown) => calls.push(['reply', options]),
    deferUpdate: async () => calls.push(['deferUpdate'])
} as unknown as ButtonInteraction);

const link = { telegram_chat_id: -7 } as ChatLink;

test('only the three RSVP choices are parsed', () => {
    assert.deepEqual(['rsvp:yes', 'rsvp:maybe', 'rsvp:no', 'rsvp:later', 'yes', undefined].map(RsvpTapHandler.parse), ['yes', 'maybe', 'no', undefined, undefined, undefined]);
});

test('a Telegram tap records the choice, re-renders the list and answers the tap', async () => {
    const { calls, handler } = fixture();
    await handler.handleTelegram(query('rsvp:maybe'));
    assert.deepEqual(calls, [
        ['getRsvpListByMessage', -7, 50],
        ['fromTelegram', { id: 11 }],
        ['setRsvpEntry', 40, 3, 'maybe'],
        ['render', 40],
        ['answerCallbackQuery', { callback_query_id: 'q' }]
    ]);
});

test('a Telegram tap on an expired list says so', async () => {
    const { calls, handler } = fixture(null);
    await handler.handleTelegram(query('rsvp:yes'));
    assert.deepEqual(calls, [
        ['getRsvpListByMessage', -7, 50],
        ['answerCallbackQuery', { callback_query_id: 'q', text: 'This RSVP has expired.' }]
    ]);
});

test('a Telegram tap that fails is answered with an error', async () => {
    const { calls, handler } = fixture(list, new Error('db down'));
    await handler.handleTelegram(query('rsvp:yes'));
    assert.deepEqual(calls.at(-1), ['answerCallbackQuery', { callback_query_id: 'q', text: 'Something went wrong.' }]);
});

test('a Telegram tap on another button is ignored', async () => {
    const { calls, handler } = fixture();
    await handler.handleTelegram(query('rsvp:later'));
    assert.deepEqual(calls, []);
});

test('a Discord tap records the choice for the linked chat and re-renders the list', async () => {
    const { calls, handler } = fixture();
    await handler.handleDiscord(interaction('rsvp:no', calls), link);
    assert.deepEqual(calls, [
        ['getRsvpListByDiscordMessage', '900', '901'],
        ['fromDiscord', { id: '44', username: 'kit', global_name: 'Kit' }],
        ['addUserChat', 4, -7],
        ['deferUpdate'],
        ['setRsvpEntry', 40, 4, 'no'],
        ['render', 40]
    ]);
});

test('a Discord tap on an expired list is told so privately', async () => {
    const { calls, handler } = fixture(null);
    await handler.handleDiscord(interaction('rsvp:yes', calls), link);
    assert.deepEqual(calls, [
        ['getRsvpListByDiscordMessage', '900', '901'],
        ['reply', { content: 'This RSVP has expired.', flags: MessageFlags.Ephemeral }]
    ]);
});

test('a Discord tap on another button is ignored', async () => {
    const { calls, handler } = fixture();
    await handler.handleDiscord(interaction('steam:yes', calls), link);
    assert.deepEqual(calls, []);
});

const withYes = (names: string[]): RsvpList => ({
    ...list,
    entries: Object.fromEntries(names.map((name, i) => [String(i + 1), { user_id: i + 1, name, rsvp: 'yes' as const, responded_at: new Date(1000 * (i + 1)) }]))
});

const pings = (calls: unknown[][]): unknown[][] => calls.filter(call => call[0] === 'ping');

test('the tap that fills the lobby pings everyone in it', async () => {
    const { calls, handler } = fixture(withYes(['Ann', 'Bob', 'Cid', 'Dee']), undefined, withYes(['Ann', 'Bob', 'Cid', 'Dee', 'Eve']));
    await handler.handleTelegram(query('rsvp:yes'));
    assert.deepEqual(pings(calls), [['ping', -7, 'Lobby full! ', ['Ann', 'Bob', 'Cid', 'Dee', 'Eve']]]);
    assert.deepEqual(calls.at(-1), ['answerCallbackQuery', { callback_query_id: 'q' }]);
});

test('a yes on a full lobby waitlists quietly', async () => {
    const { calls, handler } = fixture(withYes(['Ann', 'Bob', 'Cid', 'Dee', 'Eve']), undefined, withYes(['Ann', 'Bob', 'Cid', 'Dee', 'Eve', 'Fay']));
    await handler.handleTelegram(query('rsvp:yes'));
    assert.deepEqual(pings(calls), []);
});

test('a player dropping out pings the first one waiting that they are in', async () => {
    const full: RsvpList = withYes(['Ann', 'Bob', 'Cid', 'Dee', 'Eve', 'Fay', 'Gus']);
    const dropped: RsvpList = { ...full, entries: { ...full.entries, 2: { ...full.entries[2], rsvp: 'no' } } };
    const { calls, handler } = fixture(full, undefined, dropped);
    await handler.handleTelegram(query('rsvp:no'));
    assert.deepEqual(pings(calls), [['ping', -7, "A spot opened up, you're in: ", ['Fay']]]);
});

test('a Discord tap that fills the lobby pings it too', async () => {
    const { calls, handler } = fixture(withYes(['Ann', 'Bob', 'Cid', 'Dee']), undefined, withYes(['Ann', 'Bob', 'Cid', 'Dee', 'Eve']));
    await handler.handleDiscord(interaction('rsvp:yes', calls), link);
    assert.deepEqual(pings(calls), [['ping', -7, 'Lobby full! ', ['Ann', 'Bob', 'Cid', 'Dee', 'Eve']]]);
});
