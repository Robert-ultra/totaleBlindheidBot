import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Message } from 'discord.js';
import ChatLinkDAO, { ChatLink } from '../dao/ChatLinkDAO.js';
import RelayedMessageDAO, { MessageRef } from '../dao/RelayedMessageDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { discordReply } from '../relay.js';

const link = { discord_channel_id: 'parent', telegram_chat_id: -5 } as ChatLink;

afterEach(() => {
    mock.restoreAll();
    DiscordService.instance = null;
});

const serviceWithThread = (): DiscordService => {
    const service = new DiscordService();
    (service as any).client.channels.cache.set('thread', { isThread: () => true, parentId: 'parent' });
    (service as any).client.channels.cache.set('parent', { isThread: () => false });
    mock.method(ChatLinkDAO.prototype, 'getLinkByChannel', async (channel_id: string) => channel_id === 'parent' ? link : undefined);
    return service;
};

test('a thread belongs to the link of the channel it was started in', async () => {
    const service = serviceWithThread();
    assert.equal(await (service as any).linkOf('thread'), link);
    assert.equal(await (service as any).linkOf('parent'), link);
    assert.equal(await (service as any).linkOf('elsewhere'), undefined);
});

test('messages in a thread reach the handlers, system messages do not', async () => {
    const service = serviceWithThread();
    const handled: string[] = [];
    service.onMessage(async message => {
        handled.push(message.id);
    });
    const message = (id: string, system: boolean) => ({ id, system, inGuild: () => true, channelId: 'thread', author: { id: 'u' } } as unknown as Message);

    await (service as any).handleMessage(message('m1', false));
    await (service as any).handleMessage(message('m2', true));

    assert.deepEqual(handled, ['m1']);
});

test('a thread message replies to the message the thread was started on', async () => {
    const find = mock.method(RelayedMessageDAO.prototype, 'find', async () => undefined);
    const inThread = { reference: null, channel: { isThread: () => true, id: 'starter', parentId: 'parent' } } as unknown as Message;
    const replying = { reference: { messageId: 'other', channelId: 'thread' }, channel: inThread.channel } as unknown as Message;

    await discordReply(inThread);
    await discordReply(replying);

    assert.deepEqual(find.mock.calls.map(call => call.arguments[0] as MessageRef), [
        { platform: 'discord', chat_id: 'parent', message_id: 'starter' },
        { platform: 'discord', chat_id: 'thread', message_id: 'other' }
    ]);
});
