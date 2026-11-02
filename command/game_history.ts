import { Bot } from 'node-telegram-bot-api';
import { Command } from '../MessageRouter.js';
import GameHistoryDAO, { GameHistoryEntry } from '../dao/GameHistoryDAO.js';
import { formatError } from '../utils.js';
import { asFormatted, bold, fmt, Formatted } from '../format.js';
import { DISCORD_MESSAGE_LIMIT, toDiscordMarkdown } from '../discord/markdown.js';
import { parseRawScore } from '../matchDerivation.js';
import { resolvePlayerTarget } from './playerArg.js';

const dao = new GameHistoryDAO();

// Keep the rendered reply comfortably under each platform's message cap (4096 on Telegram).
const MAX_MESSAGE_CHARS = 3900;
const MAX_DISCORD_CHARS = DISCORD_MESSAGE_LIMIT - 100;

// A raw "16-14" score as rounds (first part = player, second = opponents).
export const parseScore = (score?: string): { us: number, them: number } | null => {
    const parsed = parseRawScore(score);
    return parsed ? { us: parsed.a, them: parsed.b } : null;
};

export type GameResult = 'win' | 'loss' | 'tie';

export const scoreResult = (score?: string): GameResult | null => {
    const parsed = parseScore(score);
    if (!parsed) {
        return null;
    } else if (parsed.us > parsed.them) {
        return 'win';
    } else if (parsed.us < parsed.them) {
        return 'loss';
    }
    return 'tie';
};

export const resultEmoji = (score?: string): string => {
    switch (scoreResult(score)) {
        case 'win': return '🏆';
        case 'loss': return '☠️';
        case 'tie': return '🤝';
        default: return '•';
    }
};

// Render a name without pinging the user (zero-width space breaks the @mention).
const safeName = (name: string): string => name.replace('@', '@​');

const renderLine = (entry: GameHistoryEntry): string => {
    const parts: string[] = [];
    if (entry.map) {
        parts.push(entry.map);
    }
    if (entry.mode) {
        parts.push(entry.mode);
    }
    if (entry.score) {
        parts.push(entry.score);
    }
    if (entry.co_players && entry.co_players.length > 0) {
        parts.push(`with ${entry.co_players.map(p => safeName(p.name)).join(', ')}`);
    }
    return `${resultEmoji(entry.score)} ${parts.join(' · ')}`;
};

export default (bot: Bot, msg: Command): Promise<unknown> =>
    resolvePlayerTarget(dao, msg)
        .then(target => {
            if (!target) {
                return;  // resolvePlayerTarget already replied with the reason.
            }
            return dao.getGameHistory(msg.chat_id, target.user_id)
                .then((entries: GameHistoryEntry[]) => {
                    if (entries.length === 0) {
                        return msg.reply(target.name
                            ? `No game history for ${target.name} in this chat yet.`
                            : 'No game history yet.');
                    }

                    const header = target.name ? fmt`Game history for ${bold(target.name)}\n` : asFormatted('');

                    // Oldest → newest (newest at the bottom). Entries come back chronologically.
                    const lines = entries.map(renderLine);

                    // If the full list is too long, keep the most recent games that fit (drop the
                    // oldest) and note how many were omitted — newest still ends up at the bottom.
                    // The header counts against the budget so the whole reply stays under the cap.
                    const [limit, size] = msg.platform === 'discord'
                        ? [MAX_DISCORD_CHARS, (f: Formatted) => toDiscordMarkdown(f).length]
                        : [MAX_MESSAGE_CHARS, (f: Formatted) => f.text.length];
                    let kept = lines;
                    let omitted = 0;
                    while (size(fmt`${header}${kept.join('\n')}`) > limit && kept.length > 1) {
                        kept = kept.slice(1);
                        omitted += 1;
                    }

                    const body = kept.join('\n');
                    const text = omitted > 0 ? `…${omitted} older games omitted\n${body}` : body;
                    return msg.reply(fmt`${header}${text}`);
                });
        })
        .catch((err: Error) => msg.reply(formatError(err)));
