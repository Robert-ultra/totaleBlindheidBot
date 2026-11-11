Feature: the bot admin's Steam commands on Discord
  The bot admin (STEAM_ADMIN_TELEGRAM_USER_ID, 9999 in this suite) also runs the Steam admin
  commands from a linked Discord server, once their Discord account is linked to theirs on
  Telegram and they can manage that server. Everyone else is turned away.

  Background:
    Given a chat with id 9501
    And a user with id 9999 and first name "Admin"
    And a Discord server "9501" named "Steam Admin" with channel "95011" named "general" and member "boss" named "Boss" with id "950100000000000001"
    And Discord channel "95011" is linked to the chat
    When the user sends "/link_user Admin discord:boss" mentioning user 9999 as "Admin"
    Then the bot reply contains "to Discord user boss."

  Scenario: the Steam admin commands are offered to server managers only
    Then Discord server "9501" offers the "/steam_guard" slash command to server managers only
    And Discord server "9501" offers the "/set_steam_nickname" slash command to server managers only
    And Discord server "9501" offers the "/delete_match_record" slash command to server managers only

  Scenario: the bot admin renames the bot on Steam from Discord
    When Discord user "boss" named "Boss" with id "950100000000000001" who manages the server runs "/set_steam_nickname" with nickname "Discord Blind" in channel "95011"
    Then Discord channel "95011" receives a bot message
      """
      My Steam nickname is now Discord Blind.
      """
    And the bot's Steam nickname is "Discord Blind"

  Scenario: a server manager who is not the bot admin cannot rename the bot
    When Discord user "mod_cs" named "Mod" with id "950100000000000002" who manages the server runs "/set_steam_nickname" with nickname "Hijacked" in channel "95011"
    Then Discord channel "95011" receives a bot message
      """
      Only the bot admin can use this command.
      """
    And the bot has never been nicknamed "Hijacked" on Steam

  Scenario: the bot admin needs to manage the server too
    When Discord user "boss" named "Boss" with id "950100000000000001" runs "/set_steam_nickname" with nickname "Unmanaged" in channel "95011"
    Then Discord channel "95011" receives a bot message
      """
      Only the bot admin can use this command.
      """
    And the bot has never been nicknamed "Unmanaged" on Steam

  Scenario: the bot admin submits a Steam Guard code from Discord
    When a Steam Guard code is requested
    And Discord user "boss" named "Boss" with id "950100000000000001" who manages the server runs "/steam_guard" with code "24680" in channel "95011"
    Then Discord channel "95011" receives a bot message
      """
      Steam Guard code submitted.
      """
    And the Steam Guard callback received code "24680"
    And the bot sends no reply

  Scenario: the bot admin deletes a match record by its number from Discord
    When user 9502 sends "/steam_user_id 76561198000009502"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009502"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009502" playing CS2 as "Zed" with score "13-7" on map "Vertigo"
    And Steam reports user "76561198000009502" stopped playing
    Then chat 9501 eventually receives a new Steam message containing "won a game"
    When Discord user "boss" named "Boss" with id "950100000000000001" who manages the server runs "/delete_match_record" with record "user9502" in channel "95011"
    Then Discord channel "95011" receives a bot message containing "Give the number of the match record to delete (1 recorded):"
    And the bot sends no reply
    When Discord user "boss" named "Boss" with id "950100000000000001" who manages the server deletes the first match record listed in channel "95011"
    Then Discord channel "95011" receives a bot message containing "Deleted match record: 🏆 Vertigo"
    And the bot reply contains "Deleted match record: 🏆 Vertigo"
    When user 9502 sends "/game_history"
    Then the bot replies "No game history yet."

  Scenario: an unknown match record is not deleted
    When Discord user "boss" named "Boss" with id "950100000000000001" who manages the server runs "/delete_match_record" with record "999999999" in channel "95011"
    Then Discord channel "95011" receives a bot message
      """
      That match record no longer exists.
      """
