import { InlineKeyboardMarkup } from 'node-telegram-bot-api';
import { fmt, Formatted, link, Part } from './format.js';
import { Rsvp, RsvpEntry } from './dao/RsvpDAO.js';
import { User, userDisplayName } from './dao/UserDAO.js';
import { displayName, parseMention, userMention } from './mention.js';

export type RsvpKeyboardKind = 'schedule' | 'rollcall';

export const LOBBY_SIZE: number = Number(process.env.LOBBY_SIZE) || 5;

// Display names per choice, with the yes voters past LOBBY_SIZE split off as the waitlist.
export type RsvpLists = Record<Rsvp, string[]> & { waitlist?: string[] };

export interface Lobby {
    players: RsvpEntry[];
    waiting: RsvpEntry[];
}

// The first LOBBY_SIZE to say yes play; the rest wait in the order they said yes.
export const lobby = (entries: Record<string, RsvpEntry>): Lobby => {
    const yes: RsvpEntry[] = Object.values(entries)
        .filter(entry => entry.rsvp === 'yes')
        .sort((a, b) => (a.responded_at?.getTime() ?? 0) - (b.responded_at?.getTime() ?? 0));
    return { players: yes.slice(0, LOBBY_SIZE), waiting: yes.slice(LOBBY_SIZE) };
};

const LABELS: Record<RsvpKeyboardKind, Record<Rsvp, string>> = {
    schedule: { yes: "I'm in", maybe: 'Maybe', no: 'No' },
    rollcall: { yes: 'Joining', maybe: 'Maybe/Later', no: 'No' }
};

export const rsvpLabels = (kind: RsvpKeyboardKind): Record<Rsvp, string> => LABELS[kind];

const RSVP_EMOJI: Record<Rsvp, string> = {
    yes: '🙋‍♂️',
    maybe: '🤷‍♂️',
    no: '🙅‍♂️'
};

const BUTTON_STYLE: Record<Rsvp, string> = {
    yes: 'success',
    maybe: 'primary',
    no: 'danger'
};

// Build the inline keyboard for a message. The callback data is the same regardless
// of the keyboard kind; only the visible labels differ.
const keyboard = (kind: RsvpKeyboardKind): InlineKeyboardMarkup => ({
    inline_keyboard: [
        (['yes', 'maybe', 'no'] as Rsvp[]).map(value => ({
            text: LABELS[kind][value],
            style: BUTTON_STYLE[value],
            callback_data: `rsvp:${value}`
        }))
    ]
});

// Build a pingable mention for the tag line from a stored rotation entry.
const mentionText = (mention: string, users: Record<number, User>): Part => {
    const parsed = parseMention(mention);
    const telegram_id: number | undefined = parsed.id === undefined ? undefined : users[parsed.id]?.telegram_id;
    if (telegram_id !== undefined) {
        return link(parsed.display, `tg://user?id=${telegram_id}`);
    }
    return parsed.display;
};

interface ResolvedPerson {
    // Undefined until the person makes a selection: players are uncategorised by default.
    rsvp?: Rsvp;
    name: string;
    // The original rotation mention string, if this person is a rotation player.
    mention?: string;
}

export interface RsvpGroups {
    groups: RsvpLists;              // display names per rsvp value (only those who chose)
    tagged: string[];               // rotation mention strings whose rsvp != 'no'
}

// Combine the live rotation roster with the explicit entries on the RSVP list.
// Players are uncategorised until they tap a button; explicit entries (incl. the seeded
// initiator) place them into yes/maybe/no, and non-rotation tappers are appended as extra
// people. Every rotation player is still tagged in the mention line unless they opted out.
const resolve = (rotation: string[], entries: Record<string, RsvpEntry>): RsvpGroups => {
    const people: ResolvedPerson[] = [];
    const byId: Map<number, ResolvedPerson> = new Map();
    const byUsername: Map<string, ResolvedPerson> = new Map();
    const byEntry: Map<number, ResolvedPerson> = new Map();

    rotation.forEach(mention => {
        const parsed = parseMention(mention);
        const person: ResolvedPerson = { name: parsed.display, mention };
        people.push(person);
        if (parsed.id !== undefined) {
            byId.set(parsed.id, person);
        }
        if (parsed.username) {
            byUsername.set(parsed.username.toLowerCase(), person);
        }
    });

    Object.values(entries).forEach(entry => {
        const matched: ResolvedPerson | undefined =
            byId.get(entry.user_id) ||
            (entry.username ? byUsername.get(entry.username.toLowerCase()) : undefined);

        const person: ResolvedPerson = matched ?? { name: entry.name, mention: userMention(entry.user_id, entry.name) };
        person.rsvp = entry.rsvp;
        byEntry.set(entry.user_id, person);
        if (!matched) {
            people.push(person);
        }
    });

    const waiting: ResolvedPerson[] = lobby(entries).waiting.map(entry => byEntry.get(entry.user_id)!);
    const groups: RsvpLists = { yes: [], maybe: [], no: [], waitlist: waiting.map(person => displayName(person.name)) };
    const tagged: string[] = [];
    people.forEach(person => {
        // Only people who have actually made a selection appear in the lists.
        if (person.rsvp && !waiting.includes(person)) {
            groups[person.rsvp].push(displayName(person.name));
        }
        // Tag every rotation player who didn't opt out, and everyone else who said yes or maybe.
        if (person.mention && person.rsvp !== 'no') {
            tagged.push(person.mention);
        }
    });

    return { groups, tagged };
};

const LIST_PREFIX: Record<keyof RsvpLists, string> = { ...RSVP_EMOJI, waitlist: '⏳ Waitlist:' };

// Build the 🙋‍♂️/⏳/🤷‍♂️/🙅‍♂️ block, omitting any group that has no members.
const renderLists = (groups: RsvpLists): string =>
    (['yes', 'waitlist', 'maybe', 'no'] as (keyof RsvpLists)[])
        .filter(value => (groups[value]?.length ?? 0) > 0)
        .map(value => `${LIST_PREFIX[value]} ${groups[value]!.join(' ')}`)
        .join('\n');

const renderMessage = (base: Formatted, groups: RsvpLists): Formatted => {
    const lists: string = renderLists(groups);
    return lists ? fmt`${base}\n\n${lists}` : base;
};

// Build an RSVP entry from a user (used when seeding the initiator and when
// recording a button tap).
const entryFromUser = (user: User, rsvp: Rsvp): RsvpEntry => ({
    user_id: user.id,
    name: userDisplayName(user),
    username: user.username,
    rsvp
});

export {
    keyboard,
    mentionText,
    resolve,
    renderLists,
    renderMessage,
    entryFromUser
};
