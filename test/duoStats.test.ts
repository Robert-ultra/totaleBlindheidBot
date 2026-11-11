import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DuoStats, splitDuo } from '../stats/DuoStats.js';
import { GameHistoryEntry } from '../dao/GameHistoryDAO.js';
import { messageText } from '../format.js';

const game = (score: string, partners: number[] = [], mode = 'Competitive'): GameHistoryEntry => ({
    chat_id: 1, user_id: 1, mode, map: 'Nuke', score,
    co_players: partners.map(tg_user_id => ({ tg_user_id, name: `P${tg_user_id}` })),
    ended_at: new Date('2026-01-01T12:00:00.000Z')
});

test('a duo argument splits on "with", case-insensitively', () => {
    assert.deepEqual(splitDuo('Alice with Bob'), ['Alice', 'Bob']);
    assert.deepEqual(splitDuo('alice WITH  @bob'), ['alice', '@bob']);
    assert.deepEqual(splitDuo('with Bob'), ['', 'Bob']);
});

test('an argument without "with" between two names is not a duo', () => {
    assert.equal(splitDuo('Alice'), null);
    assert.equal(splitDuo('Without'), null);
    assert.equal(splitDuo('a with b with c'), null);
    assert.equal(splitDuo('Alice with'), null);
});

test('games together are compared with the overall competitive record', () => {
    const entries = [game('13-7', [2]), game('7-13', [2, 3]), game('7-13'), game('13-0', [2], 'Wingman')];
    assert.equal(messageText(DuoStats.of(entries, 2).render('Alice', 'Bob')).text, [
        '🤝 Alice with Bob',
        'Together: █████░░░░░ 50% (2 games)',
        'Overall: ███░░░░░░░ 33% (3 games)'
    ].join('\n'));
});

test('a pair without competitive games together is told so', () => {
    const entries = [game('13-7', [3]), game('13-7', [2], 'Wingman')];
    assert.equal(messageText(DuoStats.of(entries, 2).render('Alice', 'Bob')).text,
        'Alice hasn\'t played a competitive game with Bob yet.');
});
