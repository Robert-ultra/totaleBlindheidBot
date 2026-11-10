import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import ChatLinkDAO, { ChatLink } from '../dao/ChatLinkDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { ExtendedMessage } from '../MessageRouter.js';
import unlinkChat from '../command/unlink_chat.js';

const link = (channel: string, guild: string): ChatLink =>
    ({ discord_channel_id: channel, discord_guild_id: guild, telegram_chat_id: -5 } as ChatLink);

const admin = { api: { getChatMember: async () => ({ status: 'administrator' }) } } as unknown as Bot;

const unlink = async (argument: string, before: ChatLink[]): Promise<{ unregistered: string[]; replies: unknown[] }> => {
    let links: ChatLink[] = [...before];
    const unregistered: string[] = [];
    const replies: unknown[] = [];
    DiscordService.instance = {
        unregisterCommands: async (guild_id: string) => {
            unregistered.push(guild_id);
        },
        deleteWebhook: async () => undefined,
        sendAsBot: async () => 'notice'
    } as unknown as DiscordService;
    mock.method(ChatLinkDAO.prototype, 'getLinkByChannel', async (channel: string) => links.find(l => l.discord_channel_id === channel));
    mock.method(ChatLinkDAO.prototype, 'getLinks', async () => links);
    mock.method(ChatLinkDAO.prototype, 'getAllLinks', async () => links);
    mock.method(ChatLinkDAO.prototype, 'removeLink', async (chat_id: number, channel: string) => {
        links = links.filter(l => l.discord_channel_id !== channel);
    });
    const msg = {
        chat: { id: -5 },
        from: { id: 1 },
        command: { name: 'unlink_chat', argument, argumentTokens: argument ? [argument] : [] },
        replyPrivately: async (text: unknown) => replies.push(text)
    } as unknown as ExtendedMessage;
    await unlinkChat(admin, msg);
    return { unregistered, replies };
};

afterEach(() => {
    mock.restoreAll();
    DiscordService.instance = null;
});

test('a server keeps its slash commands while one of its channels is still linked', async () => {
    assert.deepEqual(await unlink('100000000000000001', [link('100000000000000001', 'g1'), link('100000000000000002', 'g1')]),
        { unregistered: [], replies: ['Unlinked Discord channel 100000000000000001.'] });
});

test('unlinking a server\'s last channel removes its slash commands', async () => {
    assert.deepEqual(await unlink('100000000000000001', [link('100000000000000001', 'g1'), link('100000000000000002', 'g2')]),
        { unregistered: ['g1'], replies: ['Unlinked Discord channel 100000000000000001.'] });
});

test('unlinking everything removes the slash commands of every server', async () => {
    const { unregistered } = await unlink('', [link('100000000000000001', 'g1'), link('100000000000000002', 'g2')]);
    assert.deepEqual(unregistered.sort(), ['g1', 'g2']);
});
