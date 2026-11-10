Feature: Steam IDs for Discord users
  Discord users set their own Steam IDs with /steam_user_id. Linking someone combines the Steam IDs
  of both accounts; unlinking leaves them with the Telegram account.

  Background:
    Given a chat with id 9201
    And a user with id 9999 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9201" named "Steam Server" with channel "92011" named "general"
    And Discord channel "92011" is linked to the chat

  Scenario: a Discord user sets their own Steam ID and their games are announced
    When Discord user "sam_cs" named "Sam" with id "920100000000000001" runs "/steam_user_id" with ids "76561198000009201" in channel "92011"
    Then Discord channel "92011" receives a bot message
      """
      Your Steam user ID(s) has been set to 76561198000009201
      """
    When Steam mappings are refreshed
    And Steam reports user "76561198000009201" playing CS2 as "Sammy" with score "13-4" on map "Ancient"
    And Steam reports user "76561198000009201" stopped playing
    Then chat 9201 eventually receives a new Steam message "🏆 Sammy won a game on Ancient (Competitive): 1️⃣3️⃣-4️⃣"

  Scenario: an invalid Steam ID on Discord is rejected
    When Discord user "sam_cs" named "Sam" with id "920100000000000001" runs "/steam_user_id" with ids "123" in channel "92011"
    Then Discord channel "92011" receives a bot message
      """
      Please specify your Steam user ID(s) as SteamID64 (the 17-digit number starting with 7656), separated by commas if multiple.
      """

  Scenario: after unlinking, the Steam IDs stay with the Telegram account
    When Discord user "tia_cs" named "Tia" with id "920100000000000002" runs "/steam_user_id" with ids "76561198000009202" in channel "92011"
    Then Discord channel "92011" receives a bot message
      """
      Your Steam user ID(s) has been set to 76561198000009202
      """
    When user 9202 sends "/hi"
    Then the bot replies "Hello to you too, User9202!"
    When the user sends "/link_user @user9202 discord:tia_cs"
    Then the bot replies "Linked User9202 to Discord user tia_cs."
    When the user sends "/unlink_user @user9202"
    Then the bot replies "Unlinked User9202 from Discord user tia_cs."
    When Steam mappings are refreshed
    And Steam reports user "76561198000009202" playing CS2 as "Tia" with score "13-2" on map "Dust II"
    And Steam reports user "76561198000009202" stopped playing
    Then chat 9201 eventually receives a new Steam message "🏆 Tia won a game on Dust II (Competitive): 1️⃣3️⃣-2️⃣"
    When user 9202 sends "/game_history"
    Then the bot replies "🏆 Dust II · Competitive · 13-2"
    When Discord user "tia_cs" named "Tia" with id "920100000000000002" runs "/steam_user_id" with ids "76561198000009203" in channel "92011"
    Then Discord channel "92011" receives a bot message
      """
      Your Steam user ID(s) has been set to 76561198000009203
      """

  Scenario: an admin sets a Discord user's Steam ID by bare username
    When Discord user "uma_cs" named "Uma" with id "920100000000000003" runs "/hi" in channel "92011"
    Then the bot replies "Hello to you too, uma_cs!"
    When the user sends "/steam_user_id uma_cs 76561198000009204"
    Then the bot replies "Steam user ID(s) for uma_cs has been set to 76561198000009204"

  Scenario: a bare username shared by a Telegram and a Discord user means the Telegram user
    When Discord user "user9206" named "Disco" with id "920100000000000004" runs "/hi" in channel "92011"
    Then the bot replies "Hello to you too, user9206!"
    When user 9206 sends "/hi"
    Then the bot replies "Hello to you too, User9206!"
    Given a user with id 9999 and first name "Admin"
    When the user sends "/steam_user_id user9206 76561198000009206"
    Then the bot replies "Steam user ID(s) for User9206 has been set to 76561198000009206"
    When the user sends "/steam_user_id discord:user9206 76561198000009207"
    Then the bot replies "Steam user ID(s) for user9206 has been set to 76561198000009207"

  Scenario: the admin's menu marks Discord users
    When Discord user "vic_cs" named "Vic" with id "920100000000000005" runs "/hi" in channel "92011"
    Then the bot replies "Hello to you too, vic_cs!"
    When the user sends "/steam_user_id"
    Then the bot reply starts with "Whose Steam ID(s) do you want to set?"
    And the bot reply offers a "vic_cs (Discord)" button
    When user 9999 named "Admin" taps the button containing "vic_cs"
    Then the bot replies "Reply to this message with the Steam ID(s) for vic_cs."
