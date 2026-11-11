import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageEntity } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../MessageRouter.js';
import UserDAO, { User } from '../dao/UserDAO.js';
import { parsePlayerMentions } from '../command/admin/parsePlayerMentions.js';

const bob: User = { id: 5, telegram_id: 55, name: 'Bob', username: 'bobby' };
const kit: User = { id: 6, discord_id: '66', discord_username: 'kit_cs' };

const command = (argument: string, entities: MessageEntity[] = []): ExtendedMessage => {
    const telegram = { chat: { id: -7 }, text: `/rollcall_add_player ${argument}`, entities };
    return {
        ...telegram,
        platform: 'telegram',
        chat_id: -7,
        telegram,
        command: { name: 'rollcall_add_player', argument, argumentTokens: argument.split(' '), options: {} }
    } as unknown as ExtendedMessage;
};

const knownUsers = (): void => {
    mock.method(UserDAO.prototype, 'getUserIdByUsername', async (username: string) => username === 'bobby' ? bob.id : undefined);
    mock.method(UserDAO.prototype, 'getUser', async () => bob);
    mock.method(UserDAO.prototype, 'getUserByDiscordUsername', async (username: string) => username === 'kit_cs' ? kit : undefined);
    mock.method(UserDAO.prototype, 'fromTelegram', async () => ({ id: 9, telegram_id: 99 }));
};

afterEach(() => mock.restoreAll());

test('bare names become the users known by them, Telegram or Discord', async () => {
    knownUsers();
    assert.deepEqual(await parsePlayerMentions(command('bobby kit_cs discord:kit_cs2')), { error: 'I can\'t find Discord user "kit_cs2" on any server linked to this group.' });
    assert.deepEqual(await parsePlayerMentions(command('bobby kit_cs')), { players: ['[Bob](user:5)', '[kit_cs](user:6)'] });
});

test('a typed @username stays as typed and a tapped mention keeps its text', async () => {
    knownUsers();
    const text = '/rollcall_add_player @zoe Carol';
    const tapped: MessageEntity = { type: 'text_mention', offset: text.indexOf('Carol'), length: 5, user: { id: 99, is_bot: false, first_name: 'Carol' } };
    assert.deepEqual(await parsePlayerMentions(command('@zoe Carol', [tapped])), { players: ['@zoe', '[Carol](user:9)'] });
});

test('a name nobody is known by is an error, or passed on as typed when asked to', async () => {
    knownUsers();
    assert.deepEqual(await parsePlayerMentions(command('Ghost')), { error: 'I don\'t know Ghost.' });
    assert.deepEqual(await parsePlayerMentions(command('Ghost'), true), { players: ['Ghost'] });
});

test('naming someone twice is refused', async () => {
    knownUsers();
    assert.deepEqual(await parsePlayerMentions(command('bobby bobby')), { error: 'Seems you\'ve got some duplicate entries in there, bud!' });
});
