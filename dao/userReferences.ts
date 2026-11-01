// Tables referencing user.id, with the columns that make two rows duplicates when users are merged.
export const USER_REFERENCES: { table: string; column: string; duplicateKey?: string[]; nameColumn?: string }[] = [
    { table: 'user_settings', column: 'user_id', duplicateKey: [] },
    { table: 'user_steam_id', column: 'user_id', duplicateKey: ['steam_id'] },
    { table: 'user_chat', column: 'user_id', duplicateKey: ['chat_id'] },
    { table: 'rollcall_player', column: 'user_id', duplicateKey: ['chat_id'], nameColumn: 'display_name' },
    { table: 'rsvp_entry', column: 'user_id', duplicateKey: ['rsvp_list_id'] },
    { table: 'rollcall_schedule', column: 'initiator_id' },
    { table: 'game_update', column: 'user_id', duplicateKey: ['chat_id'] },
    { table: 'game_history', column: 'user_id' },
    { table: 'game_history_coplayer', column: 'co_user_id', duplicateKey: ['game_history_id'] },
    { table: 'presence_event', column: 'user_id' }
];
