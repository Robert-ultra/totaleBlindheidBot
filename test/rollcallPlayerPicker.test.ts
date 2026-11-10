import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as settle } from 'node:timers/promises';
import { Bot, CallbackQuery } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../MessageRouter.js';
import UserDAO, { ChatUser, User } from '../dao/UserDAO.js';
import RollcallPlayerDAO, { RollcallPlayer } from '../dao/RollcallPlayerDAO.js';
import DiscordService from '../discord/DiscordService.js';
import RollcallPlayerPicker from '../command/admin/RollcallPlayerPicker.js';

const chatUsers: ChatUser[] = [
    { user_id: 1, name: 'Ann', username: 'ann_cs', discord_only: false },
    { user_id: 2, name: 'Bob', username: 'bobby', discord_only: false },
    { user_id: 3, name: 'kit_cs', discord_only: true }
];
const users: Record<number, User> = { 1: { id: 1, telegram_id: 11 }, 3: { id: 3, discord_id: '33' } };

const fixture = (roster: RollcallPlayer[]): { calls: unknown[][]; picker: RollcallPlayerPicker; bot: Bot; msg: ExtendedMessage } => {
    const calls: unknown[][] = [];
    const record = (name: string) => async (...args: unknown[]) => {
        calls.push([name, ...args]);
    };
    const userDao = { getChatUsers: async () => chatUsers, getUsers: async () => users } as unknown as UserDAO;
    const rosterDao = {
        getRollcallPlayers: async () => roster,
        addRollcallPlayer: record('addRollcallPlayer'),
        removeRollcallPlayerById: async (_chat_id: number, id: number) => roster.find(player => player.id === id)
    } as unknown as RollcallPlayerDAO;
    const bot = { api: { sendMessage: record('sendMessage'), editMessageText: record('editMessageText'), answerCallbackQuery: record('answerCallbackQuery') } } as unknown as Bot;
    const msg = { message_id: 9, chat: { id: -7 }, reply: record('reply') } as unknown as ExtendedMessage;
    return { calls, picker: new RollcallPlayerPicker(userDao, rosterDao), bot, msg };
};

const tap = (data: string): CallbackQuery => ({ id: 'q', data, message: { message_id: 50, chat: { id: -7 } } } as unknown as CallbackQuery);

const labels = (calls: unknown[][]): string[] =>
    (calls[0][1] as { reply_markup: { inline_keyboard: { text: string }[][] } }).reply_markup.inline_keyboard.map(row => row[0].text);

afterEach(() => {
    DiscordService.instance = null;
});

test('the add menu offers everyone who is not in the rollcall yet', async () => {
    const { calls, picker, bot, msg } = fixture([{ id: 70, mention: '[Ann](user:1)' }, { id: 71, mention: '@Bobby' }]);
    await picker.askWhoToAdd(bot, msg);
    assert.deepEqual(labels(calls), ['kit_cs (Discord)']);
});

test('the add menu says so when everyone is in the rollcall', async () => {
    const { calls, picker, bot, msg } = fixture([{ id: 70, mention: '[Ann](user:1)' }, { id: 71, mention: '@bobby' }, { id: 72, mention: '[kit_cs](user:3)' }]);
    await picker.askWhoToAdd(bot, msg);
    assert.deepEqual(calls, [['reply', 'Everyone I know here is already in the rollcall.']]);
});

test('the remove menu offers the rollcall, marking Discord users', async () => {
    const { calls, picker, bot, msg } = fixture([{ id: 70, mention: '[Ann](user:1)' }, { id: 71, mention: '@bobby' }, { id: 72, mention: '[kit_cs](user:3)' }]);
    await picker.askWhoToRemove(bot, msg);
    assert.deepEqual(labels(calls), ['Ann', '@bobby', 'kit_cs (Discord)']);
    assert.deepEqual((calls[0][1] as { reply_markup: { inline_keyboard: { callback_data: string }[][] } }).reply_markup.inline_keyboard[2][0].callback_data, 'rollcall_remove:72');
});

test('the remove menu says so when the rollcall is empty', async () => {
    const { calls, picker, bot, msg } = fixture([]);
    await picker.askWhoToRemove(bot, msg);
    assert.deepEqual(calls, [['reply', 'No players in the rollcall.']]);
});

test('picking someone adds them and turns the menu into the confirmation', async () => {
    const { calls, picker, bot } = fixture([]);
    assert.equal(picker.handle(bot, tap('rollcall_add:3')), true);
    await settle();
    assert.deepEqual(calls, [
        ['addRollcallPlayer', -7, '[kit_cs](user:3)'],
        ['editMessageText', { chat_id: -7, message_id: 50, text: 'Added kit_cs to the rollcall.' }],
        ['answerCallbackQuery', { callback_query_id: 'q' }]
    ]);
});

test('someone picked twice is only added once', async () => {
    const { calls, picker, bot } = fixture([{ id: 70, mention: '[Ann](user:1)' }]);
    picker.handle(bot, tap('rollcall_add:1'));
    await settle();
    assert.deepEqual(calls[0], ['editMessageText', { chat_id: -7, message_id: 50, text: 'Ann is already in the rollcall.' }]);
});

test('picking a player removes them, unless they are gone already', async () => {
    const { calls, picker, bot } = fixture([{ id: 70, mention: '[Ann](user:1)' }]);
    picker.handle(bot, tap('rollcall_remove:70'));
    picker.handle(bot, tap('rollcall_remove:99'));
    await settle();
    assert.deepEqual(calls.filter(call => call[0] === 'editMessageText').map(call => (call[1] as { text: string }).text),
        ['Removed Ann from the rollcall.', 'They are no longer in the rollcall.']);
});

test('taps on other menus are left alone', () => {
    const { calls, picker, bot } = fixture([]);
    assert.equal(picker.handle(bot, tap('steamid:3')), false);
    assert.deepEqual(calls, []);
});
