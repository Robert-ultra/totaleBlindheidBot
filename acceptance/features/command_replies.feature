Feature: command replies reach both platforms
  What the bot answers to a command is seen on Telegram and in every linked Discord channel,
  whichever side the command was given on.

  Background:
    Given a chat with id 9601
    And a user with id 9611 and first name "Tess"
    And the user is an admin of the chat
    And a Discord server "9601" named "Replies" with channels "96011" named "general" and "96012" named "cs"
    And Discord channel "96011" is linked to the chat
    And Discord channel "96012" is linked to the chat

  Scenario: the reply to a Telegram command is posted in every linked channel
    When the user sends "/rollcall_get_players"
    Then the bot replies "No players in the rollcall."
    And Discord channel "96011" receives a bot message containing "No players in the rollcall."
    And Discord channel "96012" receives a bot message containing "No players in the rollcall."

  Scenario: a Telegram command's error reply is posted on Discord too
    When the user sends "/timezone Nowhere/Land"
    Then the bot replies "Invalid timezone: Nowhere/Land"
    And Discord channel "96011" receives a bot message containing "Invalid timezone: Nowhere/Land"

  Scenario: the reply to a Discord command is posted on Telegram and in the other linked channel
    When Discord user "kit_cs" named "Kit" with id "960100000000000001" runs "/hi" in channel "96011"
    Then Discord channel "96011" receives a bot message
      """
      Hello to you too, kit\_cs!
      """
    And the bot replies "Hello to you too, kit_cs!"
    And Discord channel "96012" receives a bot message containing "Hello to you too, kit\_cs!"
    And no slash command reply is deleted in Discord channel "96011"

  Scenario: Steam Guard answers stay on Telegram
    Given a user with id 9999 and first name "Admin"
    When the user sends "/steam_guard 12345"
    Then the bot replies "No Steam Guard code is currently requested, or it was already provided."
    And Discord channel "96011" receives "/steam\_guard 12345" from "Admin"
    And Discord channel "96011" stays free of bot messages

  Scenario: a Steam ID set through the picker is confirmed on Discord
    When the user sends "/hi"
    Then the bot replies "Hello to you too, Tess!"
    Given a user with id 9999 and first name "Admin"
    When the user sends "/steam_user_id"
    Then the bot reply starts with "Whose Steam ID(s) do you want to set?"
    And Discord channel "96011" receives "/steam\_user\_id" from "Admin"
    And Discord channel "96011" stays free of bot messages
    When user 9999 named "Admin" taps the button containing "Tess"
    Then the bot replies "Reply to this message with the Steam ID(s) for Tess."
    When the latest bot message is remembered
    And the user replies "76561198000009611" to the remembered message
    Then the bot replies "Steam user ID(s) for Tess has been set to 76561198000009611"
    And Discord channel "96011" receives a bot message containing "Steam user ID(s) for Tess has been set to 76561198000009611"
    And Discord channel "96012" receives a bot message containing "Steam user ID(s) for Tess has been set to 76561198000009611"

  Scenario: a deleted match record is confirmed on Discord
    When the user sends "/steam_user_id 76561198000009612"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009612"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009612" playing CS2 as "Tess" with score "13-7" on map "Vertigo"
    And Steam reports user "76561198000009612" stopped playing
    Then chat 9601 eventually receives a new Steam message containing "won a game"
    When user 9999 sends "/delete_match_record Tess"
    Then the bot reply contains "Select the match record to delete"
    When user 9999 named "Admin" taps the button containing "13-7"
    Then the Steam message in chat 9601 is edited to contain "Deleted match record"
    And Discord channel "96011" receives a bot message containing "Deleted match record: 🏆 Vertigo · Competitive · 13-7"
    And Discord channel "96012" receives a bot message containing "Deleted match record: 🏆 Vertigo · Competitive · 13-7"
