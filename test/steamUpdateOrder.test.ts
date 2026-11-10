import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as settle } from 'node:timers/promises';
import SteamUser from 'steam-user';
import { Bot } from 'node-telegram-bot-api';
import SteamService from '../SteamService.js';

let service: SteamService | undefined;

afterEach(() => {
    service?.stop();
    SteamService.instance = null;
    mock.restoreAll();
    delete process.env.STEAM_USERNAME;
    delete process.env.STEAM_PASSWORD;
});

const startedService = (): SteamService => {
    process.env.STEAM_USERNAME = 'bot';
    process.env.STEAM_PASSWORD = 'secret';
    mock.method(SteamUser.prototype, 'logOn', () => undefined);
    mock.method(SteamUser.prototype, 'logOff', () => undefined);
    service = new SteamService({} as unknown as Bot);
    service.start();
    return service;
};

const report = (steamService: SteamService, steamId: string, update: string): void => {
    (steamService as any).client.emit('user', { getSteamID64: () => steamId }, { player_name: update });
};

test('an account\'s Steam updates are handled one after the other, other accounts are not held up', async () => {
    const steamService = startedService();
    const started: string[] = [];
    let finishFirst: () => void = () => undefined;
    const firstFinished = new Promise<void>(resolve => {
        finishFirst = resolve;
    });
    mock.method(steamService, 'handleUserUpdate', async (_steamId: string, user: { player_name: string }) => {
        started.push(user.player_name);
        if (user.player_name === 'first') {
            await firstFinished;
        }
    });

    report(steamService, '1', 'first');
    report(steamService, '1', 'second');
    report(steamService, '2', 'other account');
    await settle();
    assert.deepEqual(started, ['first', 'other account']);

    finishFirst();
    await settle();
    assert.deepEqual(started, ['first', 'other account', 'second']);
});

test('a failed Steam update does not block the account\'s next one', async () => {
    const steamService = startedService();
    mock.method(console, 'error', () => undefined);
    const started: string[] = [];
    mock.method(steamService, 'handleUserUpdate', async (_steamId: string, user: { player_name: string }) => {
        started.push(user.player_name);
        if (user.player_name === 'first') {
            throw new Error('database is down');
        }
    });

    report(steamService, '1', 'first');
    report(steamService, '1', 'second');
    await settle();

    assert.deepEqual(started, ['first', 'second']);
});
