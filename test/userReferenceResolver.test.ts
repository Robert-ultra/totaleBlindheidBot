import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import UserDAO, { User } from '../dao/UserDAO.js';
import UserReferenceResolver from '../UserReferenceResolver.js';

const telegramAnn: User = { id: 1, telegram_id: 11, username: 'ann' };
const discordAnn: User = { id: 2, discord_id: '22', discord_username: 'ann' };
const discordKit: User = { id: 3, discord_id: '33', discord_username: 'kit_cs' };

// Discord itself is not connected here, so Discord usernames come from the database.
const resolver = (): UserReferenceResolver => {
    const users: User[] = [telegramAnn, discordAnn, discordKit];
    mock.method(UserDAO.prototype, 'getUserIdByUsername', async (username: string) => users.find(user => user.username === username)?.id);
    mock.method(UserDAO.prototype, 'getUser', async (id: number) => users.find(user => user.id === id));
    mock.method(UserDAO.prototype, 'getUserByDiscordUsername', async (username: string) => users.find(user => user.discord_username === username));
    return new UserReferenceResolver();
};

afterEach(() => mock.restoreAll());

test('@name is a Telegram username only', async () => {
    assert.equal(await resolver().resolve(-7, '@ann'), telegramAnn);
    assert.equal(await resolver().resolve(-7, '@kit_cs'), undefined);
});

test('discord:name is a Discord username only', async () => {
    assert.equal(await resolver().resolve(-7, 'discord:ann'), discordAnn);
    assert.equal(await resolver().resolve(-7, 'discord:@Kit_CS'), discordKit);
    assert.equal(await resolver().resolve(-7, 'discord:nobody'), undefined);
});

test('a bare name is the Telegram user when there is one, else the Discord user', async () => {
    assert.equal(await resolver().resolve(-7, 'ann'), telegramAnn);
    assert.equal(await resolver().resolve(-7, 'Kit_CS'), discordKit);
    assert.equal(await resolver().resolve(-7, 'nobody'), undefined);
});

test('an unknown reference is reported in its own terms', () => {
    assert.equal(UserReferenceResolver.unknown('@ann'), 'I don\'t know @ann.');
    assert.equal(UserReferenceResolver.unknown('ann'), 'I don\'t know ann.');
    assert.equal(UserReferenceResolver.unknown('discord:ann'), 'I can\'t find Discord user "ann" on any server linked to this group.');
});
