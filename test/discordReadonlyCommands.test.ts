import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import { User } from '../dao/UserDAO.js';
import GameHistoryDAO, { GameHistoryEntry } from '../dao/GameHistoryDAO.js';
import RollcallPlayerDAO from '../dao/RollcallPlayerDAO.js';
import { asFormatted, Part } from '../format.js';
import { toDiscordMarkdown } from '../discord/markdown.js';
import hi from '../command/hi.js';
import gameHistory from '../command/game_history.js';
import rollcallGetPlayers from '../command/admin/rollcall_get_players.js';
import { resolvePlayerTarget } from '../command/playerArg.js';

const bot = {} as Bot;

const discordCommand = (argument: string, user: User, replies: Part[]): Command => ({
    platform: 'discord',
    chat_id: -9,
    user,
    command: { name: 'x', argument, argumentTokens: argument ? argument.split(' ') : [] },
    reply: async (text: Part) => replies.push(text)
});

afterEach(() => mock.restoreAll());

test('/hi greets Telegram and Discord users by their name, and waits for the reply', async () => {
    const replies: Part[] = [];
    await hi(bot, discordCommand('', { id: 1, discord_username: 'kit_cs' }, replies));
    await hi(bot, discordCommand('', { id: 2, name: 'Tess', telegram_id: 5 }, replies));
    assert.deepEqual(replies, ['Hello to you too, kit_cs!', 'Hello to you too, Tess!']);
});

test('/rollcall_get_players lists the rotation by name and waits for the reply', async () => {
    mock.method(RollcallPlayerDAO.prototype, 'getRollcallPlayerUsernames', async () => ['[Alice](user:3)', '@bob']);
    const replies: Part[] = [];
    await rollcallGetPlayers(bot, discordCommand('', { id: 1 }, replies));
    assert.deepEqual(replies, ['Players in rollcall:\n- Alice\n- @​bob']);
});

test('a player named on Discord is matched against the chat roster, without Telegram mentions', async () => {
    const replies: Part[] = [];
    const dao = { getChatPlayers: async () => [{ user_id: 7, name: 'Tess' }, { user_id: 8, name: 'kit', discord_username: 'kit_cs' }] } as unknown as GameHistoryDAO;
    assert.deepEqual(await resolvePlayerTarget(dao, discordCommand('kit_cs', { id: 1 }, replies)), { user_id: 8, name: 'kit' });
    assert.equal(await resolvePlayerTarget(dao, discordCommand('nobody', { id: 1 }, replies)), null);
    assert.deepEqual(replies, ['I don\'t have any recorded games for "nobody" in this chat.']);
});

test('a long game history on Discord keeps the newest games that fit in a Discord message', async () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({ map: `de_map_${i}`, mode: 'Competitive', score: '13-4', timestamp: new Date(i) })) as unknown as GameHistoryEntry[];
    mock.method(GameHistoryDAO.prototype, 'getGameHistory', async () => entries);
    const replies: Part[] = [];
    await gameHistory(bot, discordCommand('', { id: 1 }, replies));
    const content: string = toDiscordMarkdown(asFormatted(replies[0]));
    assert.ok(content.length <= 2000, `reply is ${content.length} characters`);
    assert.match(content, /^…\d+ older games omitted\n/);
    assert.match(content, /de\\_map\\_199 · Competitive · 13-4$/);
});
