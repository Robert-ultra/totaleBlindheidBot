import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { query } from './Database.js';

class RelayedReactionDAO {
    async add(relayed_id: number, user_ref: string, emoji: string[]): Promise<void> {
        await Promise.all(emoji.map(e => query<ResultSetHeader>(
            'INSERT IGNORE INTO relayed_reaction (relayed_id, user_ref, emoji) VALUES (:relayed_id, :user_ref, :emoji)',
            { relayed_id, user_ref, emoji: e }
        )));
    }

    async remove(relayed_id: number, user_ref: string, emoji: string[]): Promise<void> {
        if (emoji.length > 0) {
            await query<ResultSetHeader>(
                'DELETE FROM relayed_reaction WHERE relayed_id = :relayed_id AND user_ref = :user_ref AND emoji IN (:emoji)',
                { relayed_id, user_ref, emoji }
            );
        }
    }

    // The emoji people used on the other messages of a group, most used first.
    async elsewhere(origin_id: number, relayed_id: number): Promise<string[]> {
        const rows = await query<RowDataPacket[]>(
            'SELECT r.emoji FROM relayed_reaction r JOIN relayed_message m ON m.id = r.relayed_id ' +
            'WHERE (m.id = :origin_id OR m.origin_id = :origin_id) AND m.id <> :relayed_id ' +
            'GROUP BY r.emoji ORDER BY COUNT(*) DESC, r.emoji',
            { origin_id, relayed_id }
        );
        return rows.map(row => String(row.emoji));
    }
}

export default RelayedReactionDAO;
