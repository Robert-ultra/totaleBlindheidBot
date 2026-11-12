import { test } from 'node:test';
import assert from 'node:assert/strict';
import Streak from '../stats/Streak.js';
import { GameHistoryEntry } from '../dao/GameHistoryDAO.js';

const match = (score: string, mode: string = 'Competitive'): GameHistoryEntry =>
    ({ chat_id: 1, user_id: 1, mode, map: 'Inferno', score, co_players: [], ended_at: new Date(0) });

test('no matches make no streak', () => {
    assert.equal(Streak.current([]), null);
});

test('the run counts the latest results that are the same', () => {
    const streak = Streak.current([match('5-13'), match('13-5'), match('13-9'), match('13-11')]);
    assert.equal(streak?.result, 'win');
    assert.equal(streak?.length, 3);
});

test('a loss run is counted the same way', () => {
    const streak = Streak.current([match('13-5'), match('5-13'), match('9-13')]);
    assert.equal(streak?.result, 'loss');
    assert.equal(streak?.length, 2);
});

test('a tie as the latest result makes no streak', () => {
    assert.equal(Streak.current([match('13-5'), match('13-5'), match('13-5'), match('12-12')]), null);
});

test('a tie ends a run', () => {
    assert.equal(Streak.current([match('13-5'), match('12-12'), match('13-5')])?.length, 1);
});

test('only competitive and premier matches count', () => {
    const streak = Streak.current([
        match('13-5', 'Premier'), match('0-8', 'Casual'), match('13-5', 'premier - Competitive'), match('0-8', 'Deathmatch')
    ]);
    assert.equal(streak?.length, 2);
});

test('only modeless and other-mode matches make no streak', () => {
    assert.equal(Streak.current([{ ...match('13-5'), mode: undefined }, match('13-5', 'Wingman')]), null);
});

test('matches without a readable score are skipped', () => {
    assert.equal(Streak.current([match('13-5'), match('?'), match('13-5')])?.length, 2);
});

test('a run is notable from three on', () => {
    assert.equal(Streak.current([match('13-5'), match('13-5')])?.isNotable(), false);
    assert.equal(Streak.current([match('13-5'), match('13-5'), match('13-5')])?.isNotable(), true);
});

test('a run describes itself for a player', () => {
    assert.equal(Streak.current([match('13-5'), match('13-5'), match('13-5')])?.describe('Kit'), '🔥 Kit: 3 wins in a row');
    assert.equal(Streak.current([match('5-13'), match('5-13'), match('5-13'), match('5-13')])?.describe('Kit'), '💀 Kit: 4 losses in a row');
});
