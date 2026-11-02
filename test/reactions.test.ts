import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageReactionUpdated } from 'node-telegram-bot-api';
import { discordEmoji, telegramEmoji, telegramReactionChange } from '../reactions.js';

const update = (fields: Partial<MessageReactionUpdated>): MessageReactionUpdated => ({
    chat: { id: -100, type: 'supergroup' },
    message_id: 7,
    user: { id: 5, is_bot: false, first_name: 'Ann' },
    date: 0,
    old_reaction: [],
    new_reaction: [],
    ...fields
} as MessageReactionUpdated);

test('Telegram emoji Discord only accepts fully qualified get their presentation selector', () => {
    assert.equal(discordEmoji('❤'), '❤️');
    assert.equal(discordEmoji('❤‍🔥'), '❤️‍🔥');
    assert.equal(discordEmoji('🤷‍♀'), '🤷‍♀️');
    assert.equal(discordEmoji('👍'), '👍');
});

test('only emoji Telegram offers bots can go to Telegram, without the presentation selector', () => {
    assert.equal(telegramEmoji('❤️'), '❤');
    assert.equal(telegramEmoji('❤️‍🔥'), '❤‍🔥');
    assert.equal(telegramEmoji('🔥'), '🔥');
    assert.equal(telegramEmoji('🦀'), undefined);
});

test('a Telegram reaction update becomes what was added and taken back', () => {
    assert.deepEqual(telegramReactionChange(update({
        old_reaction: [{ type: 'emoji', emoji: '👍' }, { type: 'emoji', emoji: '🔥' }],
        new_reaction: [{ type: 'emoji', emoji: '🔥' }, { type: 'emoji', emoji: '❤' }]
    })), {
        ref: { platform: 'telegram', chat_id: '-100', message_id: '7' },
        user_ref: 'telegram:5',
        added: ['❤️'],
        removed: ['👍']
    });
});

test('custom and paid reactions are left out', () => {
    assert.deepEqual(telegramReactionChange(update({
        new_reaction: [{ type: 'custom_emoji', custom_emoji_id: '1' }, { type: 'paid' }]
    }))?.added, []);
});

test('anonymous admins react as their chat, and bots are ignored', () => {
    assert.equal(telegramReactionChange(update({ user: undefined, actor_chat: { id: -100, type: 'supergroup' } }))?.user_ref, 'telegram:-100');
    assert.equal(telegramReactionChange(update({ user: { id: 9, is_bot: true, first_name: 'Bot' } })), undefined);
    assert.equal(telegramReactionChange(update({ user: undefined })), undefined);
});
