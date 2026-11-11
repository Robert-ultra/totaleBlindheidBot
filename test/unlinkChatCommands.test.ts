import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import ChatLinkDAO, { ChatLink } from '../dao/ChatLinkDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { Command } from '../MessageRouter.js';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import unlinkChat from '../command/unlink_chat.js';

const link = (channel: string, guild: string): ChatLink =>
    ({ discord_channel_id: channel, discord_guild_id: guild, telegram_chat_id: -5 } as ChatLink);

const admin = { api: { getChatMember: async () => ({ status: 'administrator' }) } } as unknown as Bot;

const telegram = (argument: string): Command => ({
    platform: 'telegram',
    chat_id: -5,
    user: { id: 1, telegram_id: 1 },
    command: { name: 'unlink_chat', argument, argumentTokens: argument ? [argument] : [], options: {} }
} as Command);

const discord = (argument: string, from: ChatLink): Command => ({
    ...telegram(argument),
    platform: 'discord',
    discord: { interaction: { memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) }, link: from }
} as Command);

const unlink = async (argument: string, before: ChatLink[], cmd: Command = telegram(argument)): Promise<{ unregistered: string[]; replies: unknown[]; left: string[] }> => {
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
    await unlinkChat(admin, { ...cmd, replyPrivately: async (text: unknown) => replies.push(text) });
    return { unregistered, replies, left: links.map(l => l.discord_channel_id) };
};

afterEach(() => {
    mock.restoreAll();
    DiscordService.instance = null;
});

test('a server keeps its slash commands while one of its channels is still linked', async () => {
    assert.deepEqual(await unlink('100000000000000001', [link('100000000000000001', 'g1'), link('100000000000000002', 'g1')]),
        { unregistered: [], replies: ['Unlinked Discord channel 100000000000000001.'], left: ['100000000000000002'] });
});

test('unlinking a server\'s last channel removes its slash commands', async () => {
    assert.deepEqual(await unlink('100000000000000001', [link('100000000000000001', 'g1'), link('100000000000000002', 'g2')]),
        { unregistered: ['g1'], replies: ['Unlinked Discord channel 100000000000000001.'], left: ['100000000000000002'] });
});

test('unlinking everything removes the slash commands of every server', async () => {
    const { unregistered } = await unlink('', [link('100000000000000001', 'g1'), link('100000000000000002', 'g2')]);
    assert.deepEqual(unregistered.sort(), ['g1', 'g2']);
});

test('on Discord, unlinking without an id unlinks only the channel it is given in', async () => {
    const here: ChatLink = link('100000000000000001', 'g1');
    assert.deepEqual(await unlink('', [here, link('100000000000000002', 'g1')], discord('', here)),
        { unregistered: [], replies: ['Unlinked Discord channel 100000000000000001.'], left: ['100000000000000002'] });
});

test('on Discord, a channel of another server is not unlinked', async () => {
    const here: ChatLink = link('100000000000000001', 'g1');
    assert.deepEqual(await unlink('100000000000000002', [here, link('100000000000000002', 'g2')], discord('100000000000000002', here)),
        { unregistered: [], replies: ['That channel is not linked to this group.'], left: ['100000000000000001', '100000000000000002'] });
});

test('a Telegram member who is not a group admin cannot unlink', async () => {
    const replies: unknown[] = [];
    const member = { api: { getChatMember: async () => ({ status: 'member' }) } } as unknown as Bot;
    DiscordService.instance = {} as DiscordService;
    await unlinkChat(member, { ...telegram(''), replyPrivately: async (text: unknown) => replies.push(text) });
    assert.deepEqual(replies, ['Only a group admin can link or unlink Discord channels.']);
});
