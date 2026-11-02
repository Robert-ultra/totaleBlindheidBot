import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDiscordMessage, withDiscordTags } from '../discord/render.js';
import { asFormatted } from '../format.js';
import { User } from '../dao/UserDAO.js';

const users: Record<number, User> = {
    1: { id: 1, telegram_id: 777, name: 'Alice' },
    2: { id: 2, telegram_id: 778, discord_id: '123456789012345678', name: 'Bob', discord_username: 'bob' },
    3: { id: 3, discord_id: '223456789012345678', discord_name: 'Carol' },
    4: { id: 4, telegram_id: 779, username: 'Frank', discord_id: '323456789012345678' }
};

test('the tag line pings people on Discord and names the rest', () => {
    const line = withDiscordTags(asFormatted('Go!\n'), ['[Alice](user:1)', '[Bob](user:2)', '[Carol](user:3)', '@dave', 'Eve_H'], users);
    assert.equal(line, 'Go!\nAlice <@123456789012345678> <@223456789012345678> @dave Eve\\_H');
});

test('a player stored by Telegram username is pinged on Discord when linked', () => {
    assert.equal(withDiscordTags(asFormatted(''), ['@frank'], users), '<@323456789012345678>');
});

test('each tag is prefixed with its presence marker, as on Telegram', () => {
    const markers: Record<string, string> = { '[Alice](user:1)': '🟢', '[Bob](user:2)': '🔴' };
    assert.equal(withDiscordTags(asFormatted('Go!\n'), ['[Alice](user:1)', '[Bob](user:2)', '@dave'], users, markers), 'Go!\n🟢Alice 🔴<@123456789012345678> @dave');
});

test('the RSVP lists follow the base, escaped for Discord', () => {
    assert.equal(renderDiscordMessage('Go!\nAlice', { yes: ['Alice'], maybe: [], no: ['x_y'] }), 'Go!\nAlice\n\n🙋‍♂️ Alice\n🙅‍♂️ x\\_y');
    assert.equal(renderDiscordMessage('Go!\nAlice', { yes: [], maybe: [], no: [] }), 'Go!\nAlice');
});
