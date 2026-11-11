import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from 'node-telegram-bot-api';
import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { Command } from '../MessageRouter.js';
import { User } from '../dao/UserDAO.js';
import CommandPermissions from '../CommandPermissions.js';

const BOT_ADMIN = 9999;

const telegramBot = (status: string): Bot => ({ api: { getChatMember: async () => ({ status }) } } as unknown as Bot);

const telegramCommand = (user: User): Command => ({ platform: 'telegram', chat_id: -1, user } as Command);

const discordCommand = (user: User, permissions: bigint[]): Command => ({
    platform: 'discord',
    chat_id: -1,
    user,
    discord: { interaction: { memberPermissions: new PermissionsBitField(permissions) } as unknown as ChatInputCommandInteraction }
} as Command);

beforeEach(() => {
    process.env.STEAM_ADMIN_TELEGRAM_USER_ID = String(BOT_ADMIN);
});

afterEach(() => {
    delete process.env.STEAM_ADMIN_TELEGRAM_USER_ID;
});

test('a Telegram group admin is a server admin, a plain member is not', async () => {
    assert.equal(await new CommandPermissions(telegramBot('administrator')).isAdmin(telegramCommand({ id: 1, telegram_id: 5 }), 'server'), true);
    assert.equal(await new CommandPermissions(telegramBot('creator')).isAdmin(telegramCommand({ id: 1, telegram_id: 5 }), 'server'), true);
    assert.equal(await new CommandPermissions(telegramBot('member')).isAdmin(telegramCommand({ id: 1, telegram_id: 5 }), 'server'), false);
});

test('only the bot admin is a bot admin on Telegram, group admin or not', async () => {
    const permissions = new CommandPermissions(telegramBot('administrator'));
    assert.equal(await permissions.isAdmin(telegramCommand({ id: 1, telegram_id: BOT_ADMIN }), 'bot'), true);
    assert.equal(await permissions.isAdmin(telegramCommand({ id: 1, telegram_id: 5 }), 'bot'), false);
});

test('a Discord member who can manage the server is a server admin', async () => {
    const permissions = new CommandPermissions(telegramBot('member'));
    assert.equal(await permissions.isAdmin(discordCommand({ id: 1 }, [PermissionFlagsBits.ManageGuild]), 'server'), true);
    assert.equal(await permissions.isAdmin(discordCommand({ id: 1 }, [PermissionFlagsBits.SendMessages]), 'server'), false);
});

test('a Discord bot admin must manage the server and be linked to the Telegram bot admin', async () => {
    const permissions = new CommandPermissions(telegramBot('member'));
    assert.equal(await permissions.isAdmin(discordCommand({ id: 1, telegram_id: BOT_ADMIN }, [PermissionFlagsBits.ManageGuild]), 'bot'), true);
    assert.equal(await permissions.isAdmin(discordCommand({ id: 1, telegram_id: BOT_ADMIN }, []), 'bot'), false);
    assert.equal(await permissions.isAdmin(discordCommand({ id: 1, telegram_id: 5 }, [PermissionFlagsBits.ManageGuild]), 'bot'), false);
    assert.equal(await permissions.isAdmin(discordCommand({ id: 1 }, [PermissionFlagsBits.ManageGuild]), 'bot'), false);
});
