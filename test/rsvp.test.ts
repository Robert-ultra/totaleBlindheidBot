import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyboard, lobby, renderLists, resolve } from '../rsvp.js';
import { RsvpEntry } from '../dao/RsvpDAO.js';

test('the RSVP buttons are green, blue and red', () => {
    assert.deepEqual(keyboard('rollcall').inline_keyboard[0].map(b => b.style), ['success', 'primary', 'danger']);
});

const yes = (user_id: number, name: string, at: number): RsvpEntry => ({ user_id, name, rsvp: 'yes', responded_at: new Date(at) });

test('the first five to say yes make the lobby and the rest wait in the order they said yes', () => {
    const entries = Object.fromEntries([yes(1, 'Ann', 7), yes(2, 'Bob', 1), yes(3, 'Cid', 2), yes(4, 'Dee', 3), yes(5, 'Eve', 4), yes(6, 'Fay', 5), yes(7, 'Gus', 6)]
        .map(entry => [String(entry.user_id), entry]));
    const { players, waiting } = lobby({ ...entries, 8: { user_id: 8, name: 'Hal', rsvp: 'maybe' } });
    assert.deepEqual(players.map(entry => entry.name), ['Bob', 'Cid', 'Dee', 'Eve', 'Fay']);
    assert.deepEqual(waiting.map(entry => entry.name), ['Gus', 'Ann']);
});

test('waitlisted yes voters are listed apart from the lobby, rotation players by their rotation name', () => {
    const entries = Object.fromEntries([yes(1, 'ann_tg', 6), yes(2, 'Bob', 1), yes(3, 'Cid', 2), yes(4, 'Dee', 3), yes(5, 'Eve', 4), yes(6, 'Fay', 5)]
        .map(entry => [String(entry.user_id), entry]));
    const { groups } = resolve(['[Ann](user:1)'], entries);
    assert.deepEqual(groups, { yes: ['Bob', 'Cid', 'Dee', 'Eve', 'Fay'], maybe: [], no: [], waitlist: ['Ann'] });
});

test('the waitlist is rendered between the yes and maybe lists', () => {
    assert.equal(renderLists({ yes: ['Bob'], maybe: ['Hal'], no: [], waitlist: ['Ann', 'Gus'] }), '🙋‍♂️ Bob\n⏳ Waitlist: Ann Gus\n🤷‍♂️ Hal');
    assert.equal(renderLists({ yes: ['Bob'], maybe: [], no: [] }), '🙋‍♂️ Bob');
});
