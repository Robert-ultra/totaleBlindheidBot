import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecurrence, Recurrence } from '../timeUtils.js';

const wednesday = new Date('2026-11-11T12:00:00Z');

test('a weekday and a time are parsed in the given timezone', () => {
    assert.deepEqual(parseRecurrence('every thursday 21:00', 'Europe/Amsterdam'), new Recurrence(4, 21, 0, 'Europe/Amsterdam'));
    assert.deepEqual(parseRecurrence('Every Sat at 9:30pm'), new Recurrence(6, 21, 30, 'UTC'));
    assert.deepEqual(parseRecurrence('every mon 12am'), new Recurrence(1, 0, 0, 'UTC'));
    assert.deepEqual(parseRecurrence('every friday 8'), new Recurrence(5, 8, 0, 'UTC'));
});

test('anything else is not a recurrence', () => {
    ['thursday 21:00', 'every someday 21:00', 'every th 21:00', 'every thursday 24:00', 'every thursday 21:60', 'every thursday 13pm', 'every thursday']
        .forEach(input => assert.equal(parseRecurrence(input), null, input));
});

test('the next occurrence is the coming weekday at that time in the timezone', () => {
    assert.equal(new Recurrence(4, 21, 0, 'Europe/Amsterdam').next(wednesday).toISOString(), '2026-11-12T20:00:00.000Z');
    assert.equal(new Recurrence(3, 13, 30, 'UTC').next(wednesday).toISOString(), '2026-11-11T13:30:00.000Z');
});

test('an occurrence that has passed, or is now, moves to the next week', () => {
    assert.equal(new Recurrence(3, 11, 0, 'UTC').next(wednesday).toISOString(), '2026-11-18T11:00:00.000Z');
    assert.equal(new Recurrence(3, 12, 0, 'UTC').next(wednesday).toISOString(), '2026-11-18T12:00:00.000Z');
});

test('the local time is kept across a daylight saving change', () => {
    assert.equal(new Recurrence(7, 21, 0, 'Europe/Amsterdam').next(new Date('2026-10-23T12:00:00Z')).toISOString(), '2026-10-25T20:00:00.000Z');
});

test('a recurrence is described and survives storage', () => {
    const recurrence = new Recurrence(4, 21, 5, 'Europe/Amsterdam');
    assert.equal(recurrence.describe(), 'every Thursday at 21:05');
    assert.deepEqual(Recurrence.fromJSON(JSON.stringify(recurrence)), recurrence);
});
