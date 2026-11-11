import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { Command } from '../MessageRouter.js';
import { User } from '../dao/UserDAO.js';
import GameHistoryDAO, { GameHistoryEntry } from '../dao/GameHistoryDAO.js';
import SteamService from '../SteamService.js';
import { Part } from '../format.js';
import steamGuard from '../command/steam_guard.js';
import setSteamNickname from '../command/set_steam_nickname.js';
import deleteMatchRecord from '../command/admin/delete_match_record.js';

const bot = {} as Bot;
const ADMIN: User = { id: 1, telegram_id: 9999, discord_id: '11' };

const discordCommand = (argument: string, user: User, replies: Part[]): Command => ({
    platform: 'discord',
    chat_id: -9,
    user,
    command: { name: 'x', argument, argumentTokens: argument ? argument.split(' ') : [], options: {} },
    reply: async (text: Part) => replies.push(text),
    replyPrivately: async (text: Part) => replies.push(text),
    discord: {
        interaction: { memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) } as unknown as ChatInputCommandInteraction,
        link: { telegram_chat_id: -9, discord_guild_id: 'g', discord_channel_id: 'c' }
    }
});

const entry = (id: number, chat_id: number = -9): GameHistoryEntry => ({
    id, chat_id, user_id: 1, map: 'Vertigo', mode: 'Competitive', score: '13-7', co_players: [], ended_at: new Date('2026-11-11T19:40:00Z')
});

beforeEach(() => {
    process.env.STEAM_ADMIN_TELEGRAM_USER_ID = '9999';
});

afterEach(() => {
    mock.restoreAll();
    SteamService.instance = null;
    delete process.env.STEAM_ADMIN_TELEGRAM_USER_ID;
});

test('the bot admin submits a Steam Guard code from Discord', async () => {
    const codes: string[] = [];
    SteamService.instance = { submitSteamGuardCode: (code: string) => codes.push(code) > 0 } as unknown as SteamService;
    const replies: Part[] = [];
    await steamGuard(bot, discordCommand('31337', ADMIN, replies));
    await steamGuard(bot, discordCommand('666', { id: 2, telegram_id: 5 }, replies));
    assert.deepEqual(codes, ['31337']);
    assert.deepEqual(replies, ['Steam Guard code submitted.']);
});

test('the bot admin renames the bot on Steam from Discord, nobody else', async () => {
    const nicknames: string[] = [];
    SteamService.instance = { setNickname: (nickname: string) => nicknames.push(nickname) > 0 } as unknown as SteamService;
    const replies: Part[] = [];
    await setSteamNickname(bot, discordCommand('Blindganger', ADMIN, replies));
    await setSteamNickname(bot, discordCommand('Hacked', { id: 2 }, replies));
    assert.deepEqual(nicknames, ['Blindganger']);
    assert.deepEqual(replies, ['My Steam nickname is now Blindganger.', 'Only the admin can change my Steam nickname.']);
});

test('on Discord a match record is deleted by its number', async () => {
    mock.method(GameHistoryDAO.prototype, 'getGameHistoryEntryById', async (id: number) => entry(id));
    const deleted = mock.method(GameHistoryDAO.prototype, 'deleteGameHistoryEntry', async () => true);
    const replies: Part[] = [];
    await deleteMatchRecord(bot, discordCommand('#12', ADMIN, replies));
    assert.deepEqual(deleted.mock.calls.map(call => call.arguments), [[12]]);
    assert.deepEqual(replies, ['🗑️ Deleted match record: 🏆 Vertigo · Competitive · 13-7']);
});

test('on Discord a match record of another chat is not deleted', async () => {
    mock.method(GameHistoryDAO.prototype, 'getGameHistoryEntryById', async (id: number) => entry(id, -1));
    const deleted = mock.method(GameHistoryDAO.prototype, 'deleteGameHistoryEntry', async () => true);
    const replies: Part[] = [];
    await deleteMatchRecord(bot, discordCommand('12', ADMIN, replies));
    assert.equal(deleted.mock.callCount(), 0);
    assert.deepEqual(replies, ['That match record no longer exists.']);
});

test('on Discord the match records are listed privately with their numbers instead of a picker', async () => {
    mock.method(GameHistoryDAO.prototype, 'getGameHistoryPage', async () => ({ total: 2, entries: [entry(12), entry(11)] }));
    const replies: Part[] = [];
    await deleteMatchRecord(bot, discordCommand('', ADMIN, replies));
    assert.deepEqual(replies, [
        'Give the number of the match record to delete (2 recorded):\n' +
        '#12 🏆 Vertigo · Competitive · 13-7 · 11 Nov 2026 19:40 UTC\n' +
        '#11 🏆 Vertigo · Competitive · 13-7 · 11 Nov 2026 19:40 UTC'
    ]);
});

test('only the bot admin deletes match records from Discord', async () => {
    const replies: Part[] = [];
    await deleteMatchRecord(bot, discordCommand('12', { id: 2, telegram_id: 5 }, replies));
    assert.deepEqual(replies, ['Only the admin can delete match records.']);
});
