Feature: the bot's Steam nickname
  The admin (STEAM_ADMIN_TELEGRAM_USER_ID, 9999 in this suite) renames the bot's Steam account
  from Telegram.

  Scenario: the admin changes the nickname, spaces and all
    Given a chat with id 9801
    And a user with id 9999 and first name "Admin"
    When the user sends "/set_steam_nickname Totale Blindheid"
    Then the bot replies "My Steam nickname is now Totale Blindheid."
    And the bot's Steam nickname is "Totale Blindheid"

  Scenario: the new nickname is announced on Discord
    Given a chat with id 9802
    And a user with id 9999 and first name "Admin"
    And a Discord server "9802" named "Nicknames" with channel "98021" named "general"
    And Discord channel "98021" is linked to the chat
    When the user sends "/set_steam_nickname Blindganger"
    Then the bot replies "My Steam nickname is now Blindganger."
    And Discord channel "98021" receives a bot message containing "My Steam nickname is now Blindganger."

  Scenario: nobody else can change the nickname
    Given a chat with id 9803
    And a user with id 9813 and first name "Intruder"
    When the user sends "/set_steam_nickname Hacked"
    Then the bot replies "Only the admin can change my Steam nickname."
    And the bot has never been nicknamed "Hacked" on Steam

  Scenario: a nickname is needed, and Steam takes at most 32 characters
    Given a chat with id 9804
    And a user with id 9999 and first name "Admin"
    When the user sends "/set_steam_nickname"
    Then the bot replies "Usage: /set_steam_nickname <new nickname of at most 32 characters>"
    When the user sends "/set_steam_nickname Thirty-three characters is 1 over"
    Then the bot replies "Usage: /set_steam_nickname <new nickname of at most 32 characters>"
    And the bot has never been nicknamed "Thirty-three characters is 1 over" on Steam
