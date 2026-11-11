import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot, CallbackQuery } from 'node-telegram-bot-api';
import { ButtonInteraction, MessageFlags } from 'discord.js';
import RsvpDAO, { RsvpEntry, RsvpList } from '../dao/RsvpDAO.js';
import UserDAO from '../dao/UserDAO.js';
import { ChatLink } from '../dao/ChatLinkDAO.js';
import RsvpTapHandler from '../RsvpTapHandler.js';

const list: RsvpList = { rsvp_id: 40, chat_id: -7, entries: {}, messages: [], created_at: new Date() };

const fixture = (found: RsvpList | null = list, failure?: Error) => {
    const calls: unknown[][] = [];
    const record = (name: string, result?: unknown) => async (...args: unknown[]) => {
        calls.push([name, ...args]);
        return result;
    };
    const rsvpDao = {
        getRsvpListByMessage: record('getRsvpListByMessage', found ?? undefined),
        getRsvpListByDiscordMessage: record('getRsvpListByDiscordMessage', found ?? undefined),
        setRsvpEntry: async (rsvp_id: number, entry: RsvpEntry) => {
            calls.push(['setRsvpEntry', rsvp_id, entry.user_id, entry.rsvp]);
            if (failure) {
                throw failure;
            }
            return found ?? undefined;
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
    return { calls, handler: new RsvpTapHandler(bot, rsvpDao, userDao, render) };
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
