import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot, Message } from 'node-telegram-bot-api';
import { ChatInputCommandInteraction } from 'discord.js';
import MessageRouter, { Command } from '../MessageRouter.js';
import ChatLinkDAO, { ChatLink } from '../dao/ChatLinkDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { tellDiscord } from '../messenger.js';
import { bold, fmt } from '../format.js';

const links: ChatLink[] = ['a', 'b'].map(channel => ({ telegram_chat_id: -7, discord_guild_id: 'g', discord_channel_id: channel }));

const fixture = (): { calls: unknown[][]; router: MessageRouter } => {
    const calls: unknown[][] = [];
    const bot = {
        api: {
            sendMessage: async (params: unknown) => {
                calls.push(['sendMessage', params]);
                return { message_id: 50 };
            }
        }
    } as unknown as Bot;
    DiscordService.instance = {
        sendAsBot: async (channel_id: string, content: string) => {
            calls.push(['sendAsBot', channel_id, content]);
            return `copy-in-${channel_id}`;
        }
    } as unknown as DiscordService;
    mock.method(ChatLinkDAO.prototype, 'getLinks', async () => links);
    return { calls, router: new MessageRouter(bot) };
};

const telegramMessage = (text: string): Message => ({ message_id: 9, chat: { id: -7 }, text } as unknown as Message);

const interaction = (calls: unknown[][], commandName: string): ChatInputCommandInteraction => {
    const fake = {
        commandName,
        replied: false,
        options: { getString: () => null },
        editReply: async (answer: { content: string }) => {
            calls.push(['editReply', answer.content]);
            fake.replied = true;
            return { id: 'reply' };
        },
        followUp: async (answer: { content: string }) => {
            calls.push(['followUp', answer.content]);
            return { id: 'follow-up' };
        }
    };
    return fake as unknown as ChatInputCommandInteraction;
};

// Handlers are not awaited by the router; the reply is.
const replying = (reply: (cmd: Command) => Promise<unknown>): { handler: (bot: Bot, cmd: Command) => void; done: Promise<unknown> } => {
    let finish: (value: unknown) => void = () => undefined;
    const done = new Promise(resolve => {
        finish = resolve;
    });
    return { handler: (_bot, cmd) => reply(cmd).then(finish), done };
};

afterEach(() => {
    mock.restoreAll();
    DiscordService.instance = null;
});

test('the reply to a Telegram command answers it and reaches every linked Discord channel', async () => {
    const { calls, router } = fixture();
    const { handler, done } = replying(cmd => cmd.reply(fmt`Hello ${bold('Ann')}`));
    router.route('hi', handler, { discord: {} });

    router.handle(telegramMessage('/hi'), { id: 1 });
    await done;

    assert.deepEqual(calls, [
        ['sendMessage', { chat_id: -7, text: 'Hello Ann', entities: [{ type: 'bold', offset: 6, length: 3 }], reply_parameters: { message_id: 9 } }],
        ['sendAsBot', 'a', 'Hello **Ann**'],
        ['sendAsBot', 'b', 'Hello **Ann**']
    ]);
});

test('a private reply to a Telegram command stays on Telegram', async () => {
    const { calls, router } = fixture();
    const { handler, done } = replying(cmd => cmd.replyPrivately('Code submitted.'));
    router.route('steam_guard', handler, { discord: {} });

    router.handle(telegramMessage('/steam_guard 123'), { id: 1 });
    await done;

    assert.deepEqual(calls, [['sendMessage', { chat_id: -7, text: 'Code submitted.', reply_parameters: { message_id: 9 } }]]);
});

test('replies to a Discord command answer the interaction and reach Telegram and the other channels', async () => {
    const { calls, router } = fixture();
    router.route('stats', async (_bot: Bot, cmd: Command) => {
        await cmd.reply('First');
        await cmd.reply('Second');
    }, { discord: {} });

    await router.handleDiscord(interaction(calls, 'stats'), links[0], { id: 1 }, async () => undefined);

    assert.deepEqual(calls, [
        ['sendMessage', { chat_id: -7, text: 'First' }],
        ['editReply', 'First'],
        ['sendAsBot', 'b', 'First'],
        ['sendMessage', { chat_id: -7, text: 'Second' }],
        ['followUp', 'Second'],
        ['sendAsBot', 'b', 'Second']
    ]);
});

test('an unknown Discord command is only answered where it was typed', async () => {
    const { calls, router } = fixture();
    const answers: unknown[] = [];

    await router.handleDiscord(interaction(calls, 'nope'), links[0], { id: 1 }, async text => answers.push(text));

    assert.deepEqual(answers, ['I don\'t know that command.']);
    assert.deepEqual(calls, []);
});

test('telling Discord posts to every linked channel and not to Telegram', async () => {
    const { calls } = fixture();

    await tellDiscord(-7, fmt`Deleted ${bold('Mirage')}`);

    assert.deepEqual(calls, [['sendAsBot', 'a', 'Deleted **Mirage**'], ['sendAsBot', 'b', 'Deleted **Mirage**']]);
});
