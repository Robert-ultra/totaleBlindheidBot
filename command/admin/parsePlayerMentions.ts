import { User as TelegramUser } from 'node-telegram-bot-api';
import { ExtendedMessage } from '../../MessageRouter.js';
import UserDAO, { userDisplayName } from '../../dao/UserDAO.js';
import { userMention } from '../../mention.js';
import UserReferenceResolver from '../../UserReferenceResolver.js';

const userDao = new UserDAO();
const resolver = new UserReferenceResolver(userDao);

// A typed @username stays as typed. A name nobody is known by is an error, unless `keepUnknown`
// says to pass it on as typed.
export const parsePlayerMentions = async (msg: ExtendedMessage, keepUnknown: boolean = false): Promise<{ players: string[] } | { error: string }> => {
    const args: string[] = msg.command?.argumentTokens || [];
    if (args.length !== new Set(args).size) {
        return { error: 'Seems you\'ve got some duplicate entries in there, bud!' };
    }
    const text: string = msg.text ?? '';
    const tapped: Map<string, TelegramUser> = new Map((msg.entities || [])
        .filter(entity => entity.type === 'text_mention' && entity.user)
        .map(entity => [text.slice(entity.offset, entity.offset + entity.length), entity.user!]));

    const resolved = await Promise.all(args.map(async (arg): Promise<string | { error: string }> => {
        const tappedUser: TelegramUser | undefined = tapped.get(arg);
        if (tappedUser) {
            return userMention((await userDao.fromTelegram(tappedUser)).id, arg);
        } else if (arg.startsWith('@')) {
            return arg;
        }
        const user = await resolver.resolve(msg.chat.id, arg);
        if (user) {
            return userMention(user.id, userDisplayName(user));
        }
        return keepUnknown ? arg : { error: UserReferenceResolver.unknown(arg) };
    }));
    const error = resolved.find((r): r is { error: string } => typeof r !== 'string');
    return error ?? { players: resolved.filter((r): r is string => typeof r === 'string') };
};
