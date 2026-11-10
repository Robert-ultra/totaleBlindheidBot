import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as settle } from 'node:timers/promises';
import { Message } from 'node-telegram-bot-api';
import UserDAO, { User } from '../dao/UserDAO.js';
import TelegramMessageIntake from '../TelegramMessageIntake.js';

const sender: User = { id: 7, telegram_id: 70, name: 'Ann' };
const message = { message_id: 1, chat: { id: -5 }, from: { id: 70, is_bot: false, first_name: 'Ann' } } as unknown as Message;

const intake = (addUserChat: () => Promise<boolean>): { handled: unknown[][]; joined: unknown[][]; receive: (msg: Message) => Promise<void> } => {
    const handled: unknown[][] = [];
    const joined: unknown[][] = [];
    const userDao = {
        fromTelegram: async () => sender,
        addUserChat: (user_id: number, chat_id: number) => {
            joined.push([user_id, chat_id]);
            return addUserChat();
        }
    } as unknown as UserDAO;
    const messages = new TelegramMessageIntake(userDao, (msg, user) => handled.push([msg, user]));
    return { handled, joined, receive: msg => messages.receive(msg) };
};

afterEach(() => mock.restoreAll());

test('a message is handled only once its sender is on record as being in the chat', async () => {
    let recorded: (added: boolean) => void = () => undefined;
    const { handled, joined, receive } = intake(() => new Promise<boolean>(resolve => {
        recorded = resolve;
    }));

    const received = receive(message);
    await settle();
    assert.deepEqual(joined, [[7, -5]]);
    assert.deepEqual(handled, []);

    recorded(true);
    await received;
    assert.deepEqual(handled, [[message, sender]]);
});

test('a message is still handled when its sender could not be put in the chat', async () => {
    mock.method(console, 'error', () => undefined);
    const { handled, receive } = intake(async () => {
        throw new Error('database is down');
    });

    await receive(message);

    assert.deepEqual(handled, [[message, sender]]);
});

test('a message without a sender is left alone', async () => {
    const { handled, joined, receive } = intake(async () => true);

    await receive({ message_id: 2, chat: { id: -5 } } as unknown as Message);

    assert.deepEqual([handled, joined], [[], []]);
});
