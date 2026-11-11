import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPlayerArgument, mismatchReply } from '../command/playerArg.js';
import { ChatPlayer } from '../dao/GameHistoryDAO.js';

const roster: ChatPlayer[] = [
    { user_id: 1, name: 'Alice', username: 'alice_cs' },
    { user_id: 2, name: 'Bob' },
    { user_id: 3, name: 'Bob', username: 'bobby' },  // shares a display name with user 2
    { user_id: 4, name: 'eve', username: 'mallory' },  // one player's name…
    { user_id: 5, name: 'zed', username: 'eve' },       // …equals another's username
];

test('an empty argument targets the sender', () => {
    assert.deepEqual(matchPlayerArgument(roster, ''), { kind: 'self' });
    assert.deepEqual(matchPlayerArgument(roster, '   '), { kind: 'self' });
});

test('a tapped mention wins regardless of the roster', () => {
    const match = matchPlayerArgument([], 'Whoever', { user_id: 99, name: 'Whoever' });
    assert.deepEqual(match, { kind: 'player', user_id: 99, name: 'Whoever' });
});

test('a display name matches case-insensitively', () => {
    assert.deepEqual(matchPlayerArgument(roster, 'alice'), { kind: 'player', user_id: 1, name: 'Alice' });
});

test('a @username matches with or without the leading @', () => {
    assert.deepEqual(matchPlayerArgument(roster, '@alice_cs'), { kind: 'player', user_id: 1, name: 'Alice' });
    assert.deepEqual(matchPlayerArgument(roster, 'alice_cs'), { kind: 'player', user_id: 1, name: 'Alice' });
});

test('a leading @ matches usernames only, never display names', () => {
    // "Bob" is a display name but nobody's username, so an explicit @Bob finds nothing.
    assert.deepEqual(matchPlayerArgument(roster, '@Bob'), { kind: 'none', needle: '@Bob' });
});

test('a bare name goes to the Telegram username holder before anyone called that', () => {
    // "eve" is user 4's display name and user 5's Telegram username.
    assert.deepEqual(matchPlayerArgument(roster, 'eve'), { kind: 'player', user_id: 5, name: 'zed' });
    assert.deepEqual(matchPlayerArgument(roster, '@eve'), { kind: 'player', user_id: 5, name: 'zed' });
});

test('an unknown player yields none with the original needle', () => {
    assert.deepEqual(matchPlayerArgument(roster, 'Nobody'), { kind: 'none', needle: 'Nobody' });
});

test('a name shared by two players is ambiguous', () => {
    const match = matchPlayerArgument(roster, 'Bob');
    assert.equal(match.kind, 'ambiguous');
    if (match.kind === 'ambiguous') {
        assert.equal(match.needle, 'Bob');
        assert.deepEqual(match.names, ['Bob', 'Bob (@bobby)']);
    }
});

test('the same player matched by both name and username is not double-counted', () => {
    // user 3 matches "bobby" only by username; user 2 does not match, so this is unambiguous.
    assert.deepEqual(matchPlayerArgument(roster, 'bobby'), { kind: 'player', user_id: 3, name: 'Bob' });
});

const withDiscord: ChatPlayer[] = [
    { user_id: 6, name: 'Kit', discord_username: 'kit_cs' },
    { user_id: 7, name: 'Lee', username: 'kit_cs' },  // a Telegram username equal to another's Discord username
];

test('a bare word matches a Discord username too', () => {
    assert.deepEqual(matchPlayerArgument([withDiscord[0]], 'KIT_CS'), { kind: 'player', user_id: 6, name: 'Kit' });
});

test('a bare name goes to the Telegram username holder before the Discord one', () => {
    assert.deepEqual(matchPlayerArgument(withDiscord, 'kit_cs'), { kind: 'player', user_id: 7, name: 'Lee' });
});

test('discord:<username> matches Discord usernames only', () => {
    assert.deepEqual(matchPlayerArgument(withDiscord, 'discord:kit_cs'), { kind: 'player', user_id: 6, name: 'Kit' });
    assert.deepEqual(matchPlayerArgument(withDiscord, 'discord:lee'), { kind: 'none', needle: 'discord:lee' });
});

test('@username still matches Telegram usernames only', () => {
    assert.deepEqual(matchPlayerArgument(withDiscord, '@kit_cs'), { kind: 'player', user_id: 7, name: 'Lee' });
});

test('a mismatch is explained, a resolved argument is not', () => {
    assert.equal(mismatchReply({ kind: 'none', needle: 'x' }), 'I don\'t have any recorded games for "x" in this chat.');
    assert.equal(mismatchReply({ kind: 'ambiguous', needle: 'Bob', names: ['Bob', 'Bob (@bobby)'] }),
        '"Bob" matches multiple players: Bob, Bob (@bobby). Please be more specific.');
    assert.equal(mismatchReply({ kind: 'self' }), null);
    assert.equal(mismatchReply({ kind: 'player', user_id: 1, name: 'Alice' }), null);
});
