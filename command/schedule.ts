import { Bot } from 'node-telegram-bot-api';
import { DateTime } from 'luxon';
import { Command } from '../MessageRouter.js';
import { parseRecurrence, parseTime, Recurrence } from '../timeUtils.js';
import UserDAO from '../dao/UserDAO.js';
import ScheduleDAO from '../dao/ScheduleDAO.js';
import RollcallPlayerDAO from '../dao/RollcallPlayerDAO.js';
import RsvpDAO, { RsvpEntry, RsvpMessageRef } from '../dao/RsvpDAO.js';
import { formatError } from '../utils.js';
import { asFormatted, dateTime, fmt, Formatted } from '../format.js';
import { resolve, renderMessage, entryFromUser } from '../rsvp.js';
import { mentionUsers, presenceMarkers, withTags } from '../presence.js';
import { retireRsvpList, trackTaggedMessage } from '../taggedMessages.js';
import { broadcast, Broadcast, Target } from '../messenger.js';
import { renderDiscordMessage, withDiscordTags } from '../discord/render.js';

const userDao = new UserDAO();
const scheduleDao = new ScheduleDAO();
const rollcallPlayerDao = new RollcallPlayerDAO();
const rsvpDao = new RsvpDAO();

// A weekly rollcall's confirmation, and with it its RSVP list, is only posted this long before
// it, so the list isn't pruned before the rollcall fires.
export const CONFIRMATION_LEAD_MS = 12 * 60 * 60 * 1000;

// Posts the confirmation with its RSVP buttons and returns its RSVP list.
export const postScheduleConfirmation = async (bot: Bot, target: Target, scheduledTime: Date, timezone: string, entries: Record<string, RsvpEntry>, recurrence?: Recurrence): Promise<number> => {
    const chat_id: number = target.chat_id;
    const rotation: string[] = await rollcallPlayerDao.getRollcallPlayerUsernames(chat_id);
    const { groups, tagged } = resolve(rotation, entries);
    const [users, markers] = await Promise.all([mentionUsers(tagged), presenceMarkers(tagged)]);
    const timeString: string = scheduledTime.toLocaleString('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short'
    });

    // Measured from the rounded lead time so "3 hours" doesn't come out as "in 2 hours".
    const diffMinutes: number = (scheduledTime.getTime() - Date.now()) / 60000;
    const scheduled: DateTime = DateTime.fromJSDate(scheduledTime);
    const relative: string = scheduled.toRelative({ base: scheduled.minus({ minutes: Math.round(diffMinutes) }) })!;

    // Like a rollcall, the schedule tags the whole rotation up front. The
    // mention line is baked in here so it records who was pinged when scheduled.
    // Its 🟢/🟡/🔴/😶‍🌫️ presence markers are kept up to date for a while and then
    // stripped, so the stored base leaves them out.
    const heading: Formatted = fmt`Rollcall scheduled for ${dateTime(timeString, scheduledTime, 'wt')} (${dateTime(relative, scheduledTime, 'r')})${recurrence ? `, repeating ${recurrence.describe()}` : ''}`;
    const head: Formatted = tagged.length ? fmt`${heading}\n` : heading;
    const base: Formatted = withTags(head, tagged, users);
    const discordBase: string = withDiscordTags(head, tagged, users);

    const sent: Broadcast = await broadcast(bot, target,
        renderMessage(withTags(head, tagged, users, markers), groups),
        renderDiscordMessage(withDiscordTags(head, tagged, users, markers), groups),
        { keyboard: 'schedule' }
    );
    const refs: RsvpMessageRef[] = [
        ...(sent.telegram ? [{ platform: 'telegram' as const, message_id: sent.telegram.message_id, base, keyboard: 'schedule' as const }] : []),
        ...sent.discord.map(copy => ({ ...copy.where, base: asFormatted(discordBase), keyboard: 'schedule' as const }))
    ];
    if (sent.telegram) {
        await trackTaggedMessage(sent.telegram, head, tagged, true);
    }
    return rsvpDao.createRsvpList({ chat_id, entries, messages: refs });
};

const scheduleAt = async (bot: Bot, cmd: Command, scheduledTime: Date, timezone: string, recurrence?: Recurrence): Promise<unknown> => {
    const chat_id: number = cmd.chat_id;
    const user_id: number = cmd.user.id;
    // Rescheduling replaces any existing schedule for this chat: retire the previous
    // RSVP list first so its stale confirmation buttons can't record responses against
    // a schedule that will never fire.
    const previous = (await scheduleDao.getScheduledRollcalls())[chat_id];
    if (previous?.rsvp_id) {
        await retireRsvpList(bot, previous.rsvp_id);
    }
    if (recurrence && scheduledTime.getTime() - Date.now() > CONFIRMATION_LEAD_MS) {
        await scheduleDao.setScheduledRollcall(chat_id, scheduledTime, undefined, user_id, recurrence);
        const text: string = `Rollcall scheduled ${recurrence.describe()} (${timezone}). I'll post the RSVP 12 hours before each one.`;
        return broadcast(bot, cmd, asFormatted(text), text);
    }
    // Stored as a one-off until its RSVP list exists, so the timer doesn't post a confirmation too.
    await scheduleDao.setScheduledRollcall(chat_id, scheduledTime);
    // Seed the initiator into the "yes" list.
    const entries: Record<string, RsvpEntry> = { [user_id]: entryFromUser(cmd.user, 'yes') };
    const rsvp_id: number = await postScheduleConfirmation(bot, cmd, scheduledTime, timezone, entries, recurrence);
    // Store the rsvp_id + initiator on the schedule so the timer can
    // find and share the same list when the rollcall fires.
    return scheduleDao.setScheduledRollcall(chat_id, scheduledTime, rsvp_id, user_id, recurrence);
};

export default (bot: Bot, cmd: Command): Promise<unknown> => {
    const argument: string | undefined = cmd.command?.argument;
    if (!argument) {
        return cmd.reply('Please specify a time to schedule the rollcall.');
    }

    return userDao.getUserTimezone(cmd.user.id)
        .then((timezone: string) => {
            if (/^every\b/i.test(argument)) {
                const recurrence: Recurrence | null = parseRecurrence(argument, timezone);
                return recurrence
                    ? scheduleAt(bot, cmd, recurrence.next(new Date()), timezone, recurrence)
                    : cmd.reply('Invalid time format.');
            }
            const scheduledTime: Date | null = parseTime(argument, new Date(), timezone);
            if (!scheduledTime) {
                return cmd.reply('Invalid time format.');
            }

            const diffMinutes: number = (scheduledTime.getTime() - Date.now()) / 60000;
            if (diffMinutes < 2) {
                return cmd.reply('Rollcall must be scheduled at least 2 minutes in advance.');
            } else if (diffMinutes > 12 * 60) {
                return cmd.reply('Rollcall cannot be scheduled more than 12 hours in advance.');
            }
            return scheduleAt(bot, cmd, scheduledTime, timezone);
        })
        .catch((err: Error) => cmd.reply(formatError(err)));
};
