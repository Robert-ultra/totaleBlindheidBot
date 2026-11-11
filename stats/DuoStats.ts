import { GameHistoryEntry } from '../dao/GameHistoryDAO.js';
import { bold, fmt, Formatted } from '../format.js';
import { isCompetitive, Tally } from './Tally.js';

// "a with b" as its two sides; an empty first side stands for the sender.
export const splitDuo = (argument: string): [string, string] | null => {
    const parts = argument.trim().split(/(?:^|\s+)with\s+/i);
    return parts.length === 2 && parts[1] !== '' ? [parts[0], parts[1]] : null;
};

export class DuoStats {
    private constructor(private readonly together: Tally, private readonly overall: Tally) {}

    static of(entries: GameHistoryEntry[], partnerId: number): DuoStats {
        const competitive = entries.filter(entry => isCompetitive(entry.mode));
        const together = competitive.filter(entry => entry.co_players.some(co => co.tg_user_id === partnerId));
        return new DuoStats(Tally.of(together), Tally.of(competitive));
    }

    render(name: string, partner: string): Formatted {
        if (this.together.games === 0) {
            return fmt`${name} hasn't played a competitive game with ${partner} yet.`;
        }
        return fmt`${bold(`🤝 ${name} with ${partner}`)}\nTogether: ${this.together.summary()}\nOverall: ${this.overall.summary()}`;
    }
}
