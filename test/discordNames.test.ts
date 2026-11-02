import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWebhookName } from '../discord/DiscordService.js';
import { telegramName } from '../relay.js';

test('webhook names avoid the words Discord forbids, in any case', () => {
    assert.equal(sanitizeWebhookName('Clyde of Discord'), 'dada of didi');
    assert.equal(sanitizeWebhookName('CLYDE'), 'dada');
});

test('webhook names are cut to 80 characters and never empty', () => {
    assert.equal(sanitizeWebhookName('x'.repeat(100)), 'x'.repeat(80));
    assert.equal(sanitizeWebhookName(''), 'someone');
});

test('a Telegram sender is named by first and last name, then username', () => {
    assert.equal(telegramName({ id: 1, is_bot: false, first_name: 'Robin', last_name: 'J' }), 'Robin J');
    assert.equal(telegramName({ id: 1, is_bot: false, first_name: '', username: 'robin' }), 'robin');
    assert.equal(telegramName(undefined), 'someone');
});
