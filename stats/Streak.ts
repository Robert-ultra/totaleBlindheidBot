import { GameHistoryEntry } from '../dao/GameHistoryDAO.js';
import { GameResult, scoreResult } from '../command/game_history.js';

const NOTABLE_LENGTH = 3;

export default class Streak {
    private constructor(readonly result: 'win' | 'loss', readonly length: number) {}

    static counts(mode?: string): boolean {
        return !!mode && /competitive|premier/i.test(mode);
    }

    // The player's current run over their competitive and premier matches, oldest first.
    static current(history: GameHistoryEntry[]): Streak | null {
        const results: GameResult[] = history
            .filter(entry => Streak.counts(entry.mode))
            .map(entry => scoreResult(entry.score))
            .filter((result): result is GameResult => result !== null);
        const latest = results.at(-1);
        if (latest === undefined || latest === 'tie') {
            return null;
        }
        const broken = [...results].reverse().findIndex(result => result !== latest);
        return new Streak(latest, broken === -1 ? results.length : broken);
    }

    isNotable(): boolean {
        return this.length >= NOTABLE_LENGTH;
    }

    describe(name: string): string {
        return this.result === 'win'
            ? `🔥 ${name}: ${this.length} wins in a row`
            : `💀 ${name}: ${this.length} losses in a row`;
    }
}
