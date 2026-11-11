import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import MessageRouter, { Command } from '../MessageRouter.js';
import ChatLinkDAO, { ChatLink } from '../dao/ChatLinkDAO.js';
import DiscordService from '../discord/DiscordService.js';
import { Part } from '../format.js';

const link: ChatLink = { telegram_chat_id: -7, discord_guild_id: 'g', discord_channel_id: 'a' };

const interaction = (commandName: string, values: Record<string, string>, permissions: bigint[] = []): ChatInputCommandInteraction => ({
    commandName,
    options: { getString: (name: string) => values[name] ?? null },
    memberPermissions: new PermissionsBitField(permissions)
}) as unknown as ChatInputCommandInteraction;

const router = (): MessageRouter => new MessageRouter({ api: { sendMessage: async () => ({ message_id: 1 }) } } as unknown as Bot);

afterEach(() => {
    mock.restoreAll();
    delete process.env.STEAM_ADMIN_TELEGRAM_USER_ID;
});

test('a Discord command hands its handler every option it was given, and its argument', async () => {
    const seen: Command[] = [];
    const subject = router();
    subject.route('link_user', (_bot: Bot, cmd: Command) => {
        seen.push(cmd);
    }, { discord: { argument: { name: 'note', description: 'n' }, options: [{ name: 'user', description: 'u' }, { name: 'discord', description: 'd' }] } });

    await subject.handleDiscord(interaction('link_user', { note: 'hi there', discord: 'kit_cs' }), link, { id: 1 }, async () => undefined);

    assert.equal(seen[0].command.argument, 'hi there');
    assert.deepEqual(seen[0].command.options, { discord: 'kit_cs' });
});

test('a Telegram command has no named options', async () => {
    const seen: Command[] = [];
    const subject = router();
    subject.route('hi', (_bot: Bot, cmd: Command) => {
        seen.push(cmd);
    }, { discord: {} });

    subject.handle({ message_id: 1, chat: { id: -7 }, text: '/hi there' } as never, { id: 1 });

    assert.deepEqual(seen[0].command.options, {});
});

test('a server admin command is refused, only where it was typed, to a Discord member who cannot manage the server', async () => {
    const answers: Part[] = [];
    const handled: Command[] = [];
    const subject = router();
    subject.route('github_notify', (_bot: Bot, cmd: Command) => {
        handled.push(cmd);
    }, { discord: { admin: 'server' } });

    await subject.handleDiscord(interaction('github_notify', {}), link, { id: 1 }, async text => answers.push(text));
    await subject.handleDiscord(interaction('github_notify', {}, [PermissionFlagsBits.ManageGuild]), link, { id: 2 }, async text => answers.push(text));

    assert.deepEqual(answers, ['Only someone who can manage this server can use this command.']);
    assert.deepEqual(handled.map(cmd => cmd.user.id), [2]);
});

test('a bot admin command is refused to a server manager who is not the bot admin', async () => {
    process.env.STEAM_ADMIN_TELEGRAM_USER_ID = '9999';
    const answers: Part[] = [];
    const handled: Command[] = [];
    const subject = router();
    subject.route('steam_guard', (_bot: Bot, cmd: Command) => {
        handled.push(cmd);
    }, { discord: { admin: 'bot' } });

    await subject.handleDiscord(interaction('steam_guard', {}, [PermissionFlagsBits.ManageGuild]), link, { id: 1, telegram_id: 5 }, async text => answers.push(text));
    await subject.handleDiscord(interaction('steam_guard', {}, [PermissionFlagsBits.ManageGuild]), link, { id: 2, telegram_id: 9999 }, async text => answers.push(text));

    assert.deepEqual(answers, ['Only the bot admin can use this command.']);
    assert.deepEqual(handled.map(cmd => cmd.user.id), [2]);
});

test('slash commands list the argument before the other options, and mark admin commands', () => {
    const subject = router();
    subject.route('hi', () => undefined, { helpText: 'Hello', discord: {} });
    subject.route('link_user', () => undefined, { discord: { argument: { name: 'a', description: 'A' }, options: [{ name: 'b', description: 'B' }], admin: 'server' } });
    subject.route('link_chat', () => undefined);

    assert.deepEqual(subject.slashCommands, [
        { name: 'hi', description: 'Hello', options: [], admin: false },
        { name: 'link_user', description: 'link_user', options: [{ name: 'a', description: 'A' }, { name: 'b', description: 'B' }], admin: true }
    ]);
});

test('admin slash commands are registered for members who can manage the server only', async () => {
    const registered: unknown[] = [];
    const service = new DiscordService();
    (service as any).client.application = { commands: { set: async (commands: unknown) => registered.push(commands) } };
    service.setSlashCommands([
        { name: 'hi', description: 'Hello', options: [], admin: false },
        { name: 'link_user', description: 'Link', options: [{ name: 'user', description: 'U' }, { name: 'discord', description: 'D' }], admin: true }
    ]);

    await service.registerCommands('g');

    assert.deepEqual(registered, [[
        { name: 'hi', description: 'Hello', options: [], defaultMemberPermissions: null },
        {
            name: 'link_user',
            description: 'Link',
            options: [
                { type: 3, name: 'user', description: 'U', required: false },
                { type: 3, name: 'discord', description: 'D', required: false }
            ],
            defaultMemberPermissions: PermissionFlagsBits.ManageGuild
        }
    ]]);
    DiscordService.instance = null;
});
