import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userDisplayName } from '../dao/UserDAO.js';

test('a Telegram name wins, then the Telegram username', () => {
    assert.equal(userDisplayName({ id: 1, name: 'Robin', username: 'robin', discord_username: 'robin_cs' }), 'Robin');
    assert.equal(userDisplayName({ id: 1, username: 'robin', discord_username: 'robin_cs' }), 'robin');
});

test('a Discord-only user is shown by username, never by display name', () => {
    assert.equal(userDisplayName({ id: 1, discord_id: '2', discord_name: 'Dana D', discord_username: 'dana_cs' }), 'dana_cs');
});

test('a user without any name is shown by id', () => {
    assert.equal(userDisplayName({ id: 7 }), '7');
});
