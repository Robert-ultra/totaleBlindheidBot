Feature: Steam game updates on Discord
  Game updates go to the Telegram chat and every Discord channel linked to it, and the Discord
  copies follow each edit of the Telegram message.

  Background:
    Given a chat with id 9301
    And a Discord server "9301" named "Steam One" with channel "93011" named "general"
    And a Discord server "9302" named "Steam Two" with channel "93021" named "cs" where the bot lacks "Manage Webhooks"
    And Discord channel "93011" is linked to the chat
    And Discord channel "93021" is linked to the chat

  Scenario: a game update reaches every linked channel and follows its edits
    Given a user with id 9311 and first name "Tester"
    When the user sends "/steam_user_id 76561198000009301"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009301"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009301" playing CS2 on map "Inferno"
    Then chat 9301 receives a Steam message containing "is playing Counter-Strike"
    And Discord channel "93011" receives a bot message containing "is playing Counter-Strike"
    And Discord channel "93021" receives a bot message containing "is playing Counter-Strike"
    When Steam reports user "76561198000009301" stopped playing
    Then the Steam message in chat 9301 is edited to contain "🔴"
    And Discord channel "93011" sees a bot message edited to contain "🔴"
    And Discord channel "93021" sees a bot message edited to contain "🔴"

  Scenario: the end-of-game result reaches Discord
    Given a user with id 9312 and first name "Tester"
    When the user sends "/steam_user_id 76561198000009302"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009302"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009302" playing CS2 as "Sammy" with score "13-4" on map "Ancient"
    Then chat 9301 receives a Steam message containing "Sammy"
    And Discord channel "93011" receives a bot message containing "**Sammy** is playing Counter-Strike"
    When Steam reports user "76561198000009302" stopped playing
    Then chat 9301 eventually receives a new Steam message "🏆 Sammy won a game on Ancient (Competitive): 1️⃣3️⃣-4️⃣"
    And Discord channel "93011" receives a bot message
      """
      🏆 **Sammy** won a game on Ancient (Competitive): 1️⃣3️⃣-4️⃣
      """

  Scenario: a chat with Steam updates off gets none on Discord either
    Given a chat with id 9302
    And a user with id 9313 and first name "Tester"
    And the user is an admin of the chat
    And a Discord server "9303" named "Steam Off" with channel "93031" named "general"
    And Discord channel "93031" is linked to the chat
    When the user sends "/steam_updates off"
    Then the bot replies "Steam updates for this chat have been turned off."
    When the user sends "/steam_user_id 76561198000009303"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009303"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009303" playing CS2 on map "Inferno"
    Then no Steam message is posted to chat 9302
    And Discord channel "93031" receives nothing
