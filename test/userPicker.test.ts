import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot, CallbackQuery, Message } from 'node-telegram-bot-api';
import UserPicker from '../UserPicker.js';

const picker = new UserPicker('pick:');

test('people are labelled by name, with their Telegram username or as Discord users', () => {
    assert.deepEqual(UserPicker.options([
        { user_id: 1, name: 'Ann', username: 'ann_cs', discord_only: false },
        { user_id: 2, name: 'Bob', discord_only: false },
        { user_id: 3, name: 'kit_cs', discord_only: true }
    ]), [
        { id: 1, label: 'Ann (@ann_cs)' },
        { id: 2, label: 'Bob' },
        { id: 3, label: 'kit_cs (Discord)' }
    ]);
});

test('the menu answers the command with one button per person', async () => {
    const sent: unknown[] = [];
    const bot = { api: { sendMessage: async (params: unknown) => sent.push(params) } } as unknown as Bot;

    await picker.ask(bot, { message_id: 9, chat: { id: -7 } } as Message, 'Who?', [{ id: 1, label: 'Ann' }, { id: 3, label: 'kit_cs (Discord)' }]);

    assert.deepEqual(sent, [{
        chat_id: -7,
        text: 'Who?',
        reply_parameters: { message_id: 9 },
        reply_markup: { inline_keyboard: [[{ text: 'Ann', callback_data: 'pick:1' }], [{ text: 'kit_cs (Discord)', callback_data: 'pick:3' }]] }
    }]);
});

test('a tap on the menu names who was picked; other taps are not its business', () => {
    const tap = { data: 'pick:3' } as CallbackQuery;
    assert.equal(picker.handles(tap), true);
    assert.equal(picker.picked(tap), 3);
    assert.equal(picker.handles({ data: 'rsvp:yes' } as CallbackQuery), false);
    assert.equal(picker.handles({} as CallbackQuery), false);
});
