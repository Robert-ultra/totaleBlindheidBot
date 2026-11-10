import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import SteamUser from 'steam-user';
import { Bot } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../MessageRouter.js';
import SteamService from '../SteamService.js';
import setSteamNickname from '../command/set_steam_nickname.js';

const ADMIN = 9999;

afterEach(() => {
    SteamService.instance = null;
    mock.restoreAll();
    delete process.env.STEAM_ADMIN_TELEGRAM_USER_ID;
});

const run = async (from: number, argument: string, loggedOn = true): Promise<{ replies: unknown[]; nicknames: string[] }> => {
    process.env.STEAM_ADMIN_TELEGRAM_USER_ID = String(ADMIN);
    const replies: unknown[] = [];
    const nicknames: string[] = [];
    SteamService.instance = {
        setNickname: (nickname: string) => {
            if (loggedOn) {
                nicknames.push(nickname);
            }
            return loggedOn;
        }
    } as unknown as SteamService;
    await setSteamNickname({} as Bot, {
        from: { id: from },
        command: { name: 'set_steam_nickname', argument, argumentTokens: argument.split(' ') },
        reply: async (text: unknown) => replies.push(text)
    } as unknown as ExtendedMessage);
    return { replies, nicknames };
};

test('the admin renames the bot on Steam', async () => {
    assert.deepEqual(await run(ADMIN, 'Totale Blindheid'), { replies: ['My Steam nickname is now Totale Blindheid.'], nicknames: ['Totale Blindheid'] });
});

test('nobody else can rename the bot', async () => {
    assert.deepEqual(await run(5, 'Hacked'), { replies: ['Only the admin can change my Steam nickname.'], nicknames: [] });
});

test('the nickname must be given and fit Steam\'s 32 characters', async () => {
    const usage = 'Usage: /set_steam_nickname <new nickname of at most 32 characters>';
    assert.deepEqual(await run(ADMIN, ''), { replies: [usage], nicknames: [] });
    assert.deepEqual(await run(ADMIN, 'x'.repeat(33)), { replies: [usage], nicknames: [] });
    assert.deepEqual((await run(ADMIN, 'x'.repeat(32))).nicknames, ['x'.repeat(32)]);
});

test('the bot cannot be renamed while it is not logged on, or without Steam at all', async () => {
    assert.deepEqual(await run(ADMIN, 'Blindganger', false), { replies: ['I am not logged on to Steam right now.'], nicknames: [] });
    const replies: unknown[] = [];
    process.env.STEAM_ADMIN_TELEGRAM_USER_ID = String(ADMIN);
    await setSteamNickname({} as Bot, {
        from: { id: ADMIN },
        command: { name: 'set_steam_nickname', argument: 'Blindganger', argumentTokens: ['Blindganger'] },
        reply: async (text: unknown) => replies.push(text)
    } as unknown as ExtendedMessage);
    assert.deepEqual(replies, ['I am not logged on to Steam right now.']);
});

test('the Steam account keeps its online state when it is renamed', () => {
    const setPersona = mock.method(SteamUser.prototype, 'setPersona', () => undefined);
    const service = new SteamService({} as unknown as Bot);
    assert.equal(service.setNickname('Too early'), false);
    (service as any).client.steamID = { getSteamID64: () => '76561190000000000' };
    assert.equal(service.setNickname('Blindganger'), true);
    assert.deepEqual(setPersona.mock.calls.map(call => call.arguments), [[SteamUser.EPersonaState.Online, 'Blindganger']]);
});
