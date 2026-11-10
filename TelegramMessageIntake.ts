import { Message } from 'node-telegram-bot-api';
import UserDAO, { User } from './dao/UserDAO.js';

// Puts a message's sender on record, as a user and as someone in that chat, before anything acts
// on the message: what handles it may look them up.
class TelegramMessageIntake {
    private readonly userDao: UserDAO;
    private readonly handle: (msg: Message, user: User) => void;

    constructor(userDao: UserDAO, handle: (msg: Message, user: User) => void) {
        this.userDao = userDao;
        this.handle = handle;
    }

    async receive(msg: Message): Promise<void> {
        if (!msg.from) {
            return;
        }
        const user: User = await this.userDao.fromTelegram(msg.from);
        await this.userDao.addUserChat(user.id, msg.chat.id)
            .catch((err: Error) => console.error('Error adding user chat:', err));
        this.handle(msg, user);
    }
}

export default TelegramMessageIntake;
