import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import SteamUser from 'steam-user';
import { Bot } from 'node-telegram-bot-api';
import SteamService from '../SteamService.js';
import UserDAO from '../dao/UserDAO.js';
import { Command } from '../MessageRouter.js';
import steamUserId from '../command/steam_user_id.js';

let service: SteamService | undefined;

afterEach(() => {
    service?.stop();
    service = undefined;
    SteamService.instance = null;
    mock.restoreAll();
    delete process.env.STEAM_USERNAME;
    delete process.env.STEAM_PASSWORD;
});

const startedService = (friends: string[]): SteamService => {
    process.env.STEAM_USERNAME = 'bot';
    process.env.STEAM_PASSWORD = 'secret';
    mock.method(SteamUser.prototype, 'logOn', () => undefined);
    mock.method(SteamUser.prototype, 'logOff', () => undefined);
    mock.method(UserDAO.prototype, 'getAllUserSettings', async () => ({}));
    mock.method(console, 'log', () => undefined);
    service = new SteamService({} as unknown as Bot);
    service.start();
    const client = (service as any).client;
    client.myFriends = Object.fromEntries(friends.map(steamId => [steamId, SteamUser.EFriendRelationship.Friend]));
    client.myFriends['3'] = SteamUser.EFriendRelationship.RequestRecipient;
    return service;
};

test('nobody is called a stranger before the friends list has loaded', () => {
    const steam = startedService(['1']);
    assert.deepEqual(steam.notFriends(['1', '2']), []);
});

test('accounts that are not friends yet are told apart, pending requests included', () => {
    const steam = startedService(['1']);
    (steam as any).client.emit('friendsList');
    assert.deepEqual(steam.notFriends(['1', '2', '3']), ['2', '3']);
});

test('the profile to befriend is the bot\'s own, once it is logged on', () => {
    const steam = startedService([]);
    assert.equal(steam.profileUrl(), undefined);
    (steam as any).client.steamID = { getSteamID64: () => '76561190000000000' };
    assert.equal(steam.profileUrl(), 'https://steamcommunity.com/profiles/76561190000000000');
});

const setOwnIds = async (ids: string, strangers: string[]): Promise<unknown[]> => {
    const replies: unknown[] = [];
    mock.method(UserDAO.prototype, 'setSteamUserId', async () => undefined);
    SteamService.instance = {
        notFriends: (steamIds: string[]) => steamIds.filter(steamId => strangers.includes(steamId)),
        profileUrl: () => 'https://steamcommunity.com/profiles/76561190000000000'
    } as unknown as SteamService;
    const cmd: Command = {
        platform: 'discord',
        chat_id: 1,
        user: { id: 7 },
        command: { name: 'steam_user_id', argument: ids, argumentTokens: ids.split(' ') },
        reply: async text => replies.push(text),
        replyPrivately: async () => undefined
    };
    await steamUserId({} as Bot, cmd);
    return replies;
};

test('linking a Steam account that is not a friend yet says who to add', async () => {
    assert.deepEqual(await setOwnIds('76561198000000001, 76561198000000002', ['76561198000000002']), [
        'Your Steam user ID(s) has been set to 76561198000000001, 76561198000000002\n\n'
        + 'Note: 76561198000000002 is not on my Steam friends list yet. '
        + 'I only get game updates from friends, so add me on Steam: https://steamcommunity.com/profiles/76561190000000000'
    ]);
});

test('linking friends\' Steam accounts needs no note', async () => {
    assert.deepEqual(await setOwnIds('76561198000000001', []), ['Your Steam user ID(s) has been set to 76561198000000001']);
});
