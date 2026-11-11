import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { Command } from '../MessageRouter.js';
import UserDAO, { User } from '../dao/UserDAO.js';
import ChatLinkDAO from '../dao/ChatLinkDAO.js';
import RollcallPlayerDAO from '../dao/RollcallPlayerDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { Part } from '../format.js';
import { parsePlayerMentions, playerReferences } from '../command/admin/parsePlayerMentions.js';
import linkUser from '../command/link_user.js';
import unlinkUser from '../command/unlink_user.js';
import rollcallAddPlayer from '../command/admin/rollcall_add_player.js';
import rollcallRemovePlayer from '../command/admin/rollcall_remove_player.js';

const bot = {} as Bot;
const tess: User = { id: 5, telegram_id: 55, name: 'Tess', username: 'tess' };
const kit: User = { id: 6, discord_id: '66', discord_username: 'kit_cs', discord_name: 'Kit' };

const discordCommand = (options: Record<string, string>, replies: Part[]): Command => ({
    platform: 'discord',
    chat_id: -9,
    user: { id: 1 },
    command: { name: 'x', argument: '', argumentTokens: [], options },
    reply: async (text: Part) => replies.push(text),
    replyPrivately: async (text: Part) => replies.push(text),
    discord: {
        interaction: { memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) } as unknown as ChatInputCommandInteraction,
        link: { telegram_chat_id: -9, discord_guild_id: 'g', discord_channel_id: 'c' }
    }
});

const knownUsers = (): void => {
    mock.method(UserDAO.prototype, 'getUserIdByUsername', async (username: string) => username === 'tess' ? tess.id : undefined);
    mock.method(UserDAO.prototype, 'getUser', async () => tess);
    mock.method(UserDAO.prototype, 'getUserByDiscordUsername', async (username: string) => username === 'kit_cs' ? kit : undefined);
    mock.method(ChatLinkDAO.prototype, 'getLinks', async () => []);
};

afterEach(() => {
    mock.restoreAll();
    DiscordService.instance = null;
});

test('Telegram names players in its arguments, Discord in its user and discord options', () => {
    assert.deepEqual(playerReferences({ platform: 'telegram', command: { argumentTokens: ['@tess', 'kit'] } } as Command), ['@tess', 'kit']);
    assert.deepEqual(playerReferences(discordCommand({ user: 'tess', discord: 'kit_cs' }, [])), ['tess', 'discord:kit_cs']);
    assert.deepEqual(playerReferences(discordCommand({ discord: 'discord:kit_cs' }, [])), ['discord:kit_cs']);
    assert.deepEqual(playerReferences(discordCommand({}, [])), []);
});

test('players named on Discord become the users known by them', async () => {
    knownUsers();
    assert.deepEqual(await parsePlayerMentions(discordCommand({ user: 'tess', discord: 'kit_cs' }, [])), { players: ['[Tess](user:5)', '[kit_cs](user:6)'] });
});

test('/rollcall_add_player on Discord adds the named players, and waits for the reply', async () => {
    knownUsers();
    mock.method(RollcallPlayerDAO.prototype, 'getRollcallPlayerUsernames', async () => []);
    const added = mock.method(RollcallPlayerDAO.prototype, 'addRollcallPlayer', async () => undefined);
    const replies: Part[] = [];
    await rollcallAddPlayer(bot, discordCommand({ discord: 'kit_cs' }, replies));
    assert.deepEqual(added.mock.calls.map(call => call.arguments), [[-9, '[kit_cs](user:6)']]);
    assert.deepEqual(replies, ['Added 1 players to rollcall.']);
});

test('the rollcall player commands on Discord ask for someone to be named instead of showing a menu', async () => {
    const replies: Part[] = [];
    await rollcallAddPlayer(bot, discordCommand({}, replies));
    await rollcallRemovePlayer(bot, discordCommand({}, replies));
    assert.deepEqual(replies, [
        'Name a player with the user or discord option.',
        'Name a player with the user or discord option.'
    ]);
});

test('/rollcall_remove_player on Discord removes the named player', async () => {
    knownUsers();
    const removed = mock.method(RollcallPlayerDAO.prototype, 'removeRollcallPlayer', async () => true);
    const replies: Part[] = [];
    await rollcallRemovePlayer(bot, discordCommand({ user: 'tess' }, replies));
    assert.deepEqual(removed.mock.calls.map(call => call.arguments), [[-9, '[Tess](user:5)']]);
    assert.deepEqual(replies, ['Poof! They\'re gone!']);
});

test('/link_user on Discord links the Telegram user to the Discord user', async () => {
    knownUsers();
    DiscordService.instance = { findMember: async () => undefined } as unknown as DiscordService;
    const linked = mock.method(UserDAO.prototype, 'linkDiscord', async () => ({ ...tess, discord_username: 'kit_cs' }));
    const replies: Part[] = [];
    await linkUser(bot, discordCommand({ user: '@tess', discord: 'kit_cs' }, replies));
    assert.deepEqual(linked.mock.calls.map(call => call.arguments), [[5, { id: '66', username: 'kit_cs', global_name: 'Kit' }]]);
    assert.deepEqual(replies, ['Linked Tess to Discord user kit_cs.']);
});

test('/link_user on Discord needs both users', async () => {
    DiscordService.instance = {} as DiscordService;
    const replies: Part[] = [];
    await linkUser(bot, discordCommand({ user: 'tess' }, replies));
    assert.deepEqual(replies, ['Name the Telegram user with the user option and the Discord user with the discord option.']);
});

test('/unlink_user on Discord unlinks by the Telegram or the Discord user', async () => {
    const linkedTess: User = { ...tess, discord_id: '66', discord_username: 'kit_cs' };
    mock.method(UserDAO.prototype, 'getUserIdByUsername', async () => linkedTess.id);
    mock.method(UserDAO.prototype, 'getUser', async () => linkedTess);
    mock.method(UserDAO.prototype, 'getUserByDiscordUsername', async () => linkedTess);
    mock.method(ChatLinkDAO.prototype, 'getLinks', async () => []);
    const unlinked = mock.method(UserDAO.prototype, 'unlinkDiscord', async () => undefined);
    const replies: Part[] = [];
    await unlinkUser(bot, discordCommand({ user: 'tess' }, replies));
    await unlinkUser(bot, discordCommand({ discord: 'kit_cs' }, replies));
    await unlinkUser(bot, discordCommand({}, replies));
    assert.deepEqual(unlinked.mock.calls.map(call => call.arguments), [[5], [5]]);
    assert.deepEqual(replies, [
        'Unlinked Tess from Discord user kit_cs.',
        'Unlinked Tess from Discord user kit_cs.',
        'Name a user with the user or discord option.'
    ]);
});

test('/unlink_user on Discord says when the Discord user has no Telegram account to unlink from', async () => {
    mock.method(UserDAO.prototype, 'getUserByDiscordUsername', async () => kit);
    mock.method(ChatLinkDAO.prototype, 'getLinks', async () => []);
    const unlinked = mock.method(UserDAO.prototype, 'unlinkDiscord', async () => undefined);
    const replies: Part[] = [];
    await unlinkUser(bot, discordCommand({ discord: 'kit_cs' }, replies));
    assert.equal(unlinked.mock.callCount(), 0);
    assert.deepEqual(replies, ['kit_cs is not linked to a Telegram user.']);
});
