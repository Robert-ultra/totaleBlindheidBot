import { Bot, CallbackQuery, InlineKeyboardButton, Message } from 'node-telegram-bot-api';
import { ChatUser } from './dao/UserDAO.js';

export interface PickerOption {
    id: number;
    label: string;
}

// An inline keyboard to pick one person from. A tap comes back as callback data `<prefix><id>`.
class UserPicker {
    private readonly prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    static label(user: ChatUser): string {
        if (user.discord_only) {
            return `${user.name} (Discord)`;
        }
        return user.username ? `${user.name} (@${user.username})` : user.name;
    }

    static options(users: ChatUser[]): PickerOption[] {
        return users.map(user => ({ id: user.user_id, label: UserPicker.label(user) }));
    }

    keyboard(options: PickerOption[]): InlineKeyboardButton[][] {
        return options.map(option => [{ text: option.label, callback_data: `${this.prefix}${option.id}` }]);
    }

    ask(bot: Bot, msg: Message, question: string, options: PickerOption[]): Promise<Message> {
        return bot.api.sendMessage({
            chat_id: msg.chat.id,
            text: question,
            reply_parameters: { message_id: msg.message_id },
            reply_markup: { inline_keyboard: this.keyboard(options) }
        });
    }

    handles(query: CallbackQuery): boolean {
        return !!query.data?.startsWith(this.prefix);
    }

    picked(query: CallbackQuery): number {
        return Number(query.data!.slice(this.prefix.length));
    }
}

export default UserPicker;
