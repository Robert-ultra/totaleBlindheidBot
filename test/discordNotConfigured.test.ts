import { test } from 'node:test';
import assert from 'node:assert/strict';
import linkChat, { NOT_CONFIGURED } from '../command/link_chat.js';
import unlinkChat from '../command/unlink_chat.js';
import linkUser from '../command/link_user.js';
import DiscordService from '../discord/DiscordService.js';
import { ExtendedMessage } from '../MessageRouter.js';

const message = (replies: unknown[]): ExtendedMessage => ({
    chat: { id: 1, type: 'group' },
    from: { id: 2, is_bot: false, first_name: 'Admin' },
    command: { name: 'x', argument: '123', argumentTokens: ['123'] },
    reply: async (text: unknown) => { replies.push(text); },
    replyPrivately: async (text: unknown) => { replies.push(text); }
} as unknown as ExtendedMessage);

[['link_chat', linkChat], ['unlink_chat', unlinkChat], ['link_user', linkUser]].forEach(([name, handler]) => {
    test(`${name} says Discord is not configured when the bot has no Discord token`, async () => {
        assert.equal(DiscordService.instance, null);
        const replies: unknown[] = [];
        await (handler as typeof linkChat)(undefined as never, message(replies));
        assert.deepEqual(replies, [NOT_CONFIGURED]);
    });
});
