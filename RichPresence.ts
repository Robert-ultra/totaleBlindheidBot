export interface SteamRichPresenceItem {
    key: string;
    value: string;
}

export interface RichPresenceSource {
    rich_presence?: SteamRichPresenceItem[] | Record<string, string>;
    rich_presence_string?: string;
}

// What a CS2 player's Steam rich presence says about their game.
export default class RichPresence {
    readonly map?: string;
    readonly mode?: string;
    // The score without brackets, e.g. "16-14".
    readonly rawScore?: string;
    // For display: the summary string when Steam sends one, else the raw status.
    readonly status?: string;
    readonly party?: string;

    constructor(user: RichPresenceSource) {
        const values: Record<string, string> = RichPresence.toRecord(user.rich_presence);
        const rawStatus: string | undefined = values['status'];
        this.map = values['game:map'] || values['map'];
        this.status = user.rich_presence_string || rawStatus;
        // The mode often isn't its own key, so fall back to the raw status (e.g. "Competitive"),
        // not the volatile summary, which would split one match into many. Only on a map: in the
        // menu or a lobby the status says something else.
        this.mode = values['game:mode'] || values['mode'] || (this.map ? rawStatus : undefined);
        this.rawScore = (values['game:score'] || values['score'])?.replace(/[\[\]]/g, '').trim() || undefined;
        this.party = values['steam_player_group'] || undefined;
    }

    private static toRecord(rp: RichPresenceSource['rich_presence']): Record<string, string> {
        if (Array.isArray(rp)) {
            return rp.reduce((record: Record<string, string>, { key, value }) => ({ [key]: value, ...record }), {});
        }
        return rp && typeof rp === 'object' ? rp : {};
    }
}
