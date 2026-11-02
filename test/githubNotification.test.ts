import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitTexts } from '../GitHubService.js';

const commit = { sha: 'abc', html_url: 'https://example.test/commit/abc', commit: { message: 'Fix a_b\n\n- details' } };

test('the Telegram text quotes the message in an expandable blockquote', () => {
    const { telegram } = commitTexts(commit);
    assert.equal(telegram.text, 'New commit: https://example.test/commit/abc\nFix a_b\n\n- details');
    assert.deepEqual(telegram.entities, [{ type: 'expandable_blockquote', offset: 44, length: 18 }]);
});

test('the Discord text suppresses the embed and quotes the escaped message', () => {
    assert.equal(commitTexts(commit).discord, 'New commit: <https://example.test/commit/abc>\n> Fix a\\_b\n> \n> \\- details');
});
