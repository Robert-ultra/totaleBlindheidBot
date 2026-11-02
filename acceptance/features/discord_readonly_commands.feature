Feature: read-only commands on Discord
  /hi, /help, /stats, /game_history and /rollcall_get_players work as slash commands in a linked
  channel and answer there.

  Background:
    Given a chat with id 9401
    And a user with id 9411 and first name "Tess"
    And the user is an admin of the chat
    And a Discord server "9401" named "Commands" with channel "94011" named "general"
    And Discord channel "94011" is linked to the chat

  Scenario: /hi greets the Discord user by their username
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/hi" in channel "94011"
    Then Discord channel "94011" receives a bot message
      """
      Hello to you too, kit\_cs!
      """
    And no slash command reply is deleted in Discord channel "94011"

  Scenario: /help on Discord lists the slash commands only
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/help" in channel "94011"
    Then Discord channel "94011" receives a bot message containing "/hi: Craving that small talk, are you?"
    And Discord channel "94011" receives a bot message containing "/game\_history: Show CS2 game history for this chat."
    And Discord channel "94011" receives no bot message containing "link\_chat"

  Scenario: /rollcall_get_players lists the rotation on Discord
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/rollcall_get_players" in channel "94011"
    Then Discord channel "94011" receives a bot message
      """
      No players in the rollcall.
      """
    When the user sends "/rollcall_add_player Alice" mentioning user 9412 as "Alice"
    Then the bot replies "Added 1 players to rollcall."
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/rollcall_get_players" in channel "94011"
    Then Discord channel "94011" receives a bot message
      """
      Players in rollcall:
      \- Alice
      """
    And no slash command reply is deleted in Discord channel "94011"

  Scenario: /game_history and /stats on Discord, for yourself and for another player
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/steam_user_id" with ids "76561198000009401" in channel "94011"
    Then Discord channel "94011" receives a bot message
      """
      Your Steam user ID(s) has been set to 76561198000009401
      """
    When the user sends "/steam_user_id 76561198000009402"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009402"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009401" playing CS2 as "Kit" with score "13-4" on map "Ancient"
    And Steam reports user "76561198000009401" stopped playing
    Then chat 9401 eventually receives a new Steam message containing "Kit won a game on Ancient"
    When Steam reports user "76561198000009402" playing CS2 as "Tess" with score "9-13" on map "Nuke"
    And Steam reports user "76561198000009402" stopped playing
    Then chat 9401 eventually receives a new Steam message containing "Tess lost a game on Nuke"
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/game_history" in channel "94011"
    Then Discord channel "94011" receives a bot message
      """
      🏆 Ancient · Competitive · 13-4
      """
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/game_history" with player "Tess" in channel "94011"
    Then Discord channel "94011" receives a bot message
      """
      Game history for **Tess**
      ☠️ Nuke · Competitive · 9-13
      """
    And no slash command reply is deleted in Discord channel "94011"
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/stats" in channel "94011"
    Then Discord channel "94011" receives a bot message starting with "**📊 Overview**"
    And Discord channel "94011" receives a bot message containing "Competitive games: 1 (1 won, 0 lost, 0 tied)"
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/stats" with player "Tess" in channel "94011"
    Then Discord channel "94011" receives a bot message starting with "Competitive stats for **Tess**"
    And no slash command reply is deleted in Discord channel "94011"
    When Discord user "kit_cs" named "Kit" with id "940100000000000001" runs "/stats" with player "nobody" in channel "94011"
    Then Discord channel "94011" receives a bot message
      """
      I don't have any recorded games for "nobody" in this chat.
      """
    And no slash command reply is deleted in Discord channel "94011"
