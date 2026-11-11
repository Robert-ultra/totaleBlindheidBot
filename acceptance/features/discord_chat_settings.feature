Feature: chat settings from Discord
  People who can manage a linked Discord server change the group's settings with slash commands.
  Discord shows these commands to them only, and the bot turns everyone else away.

  Background:
    Given a chat with id 6601
    And a user with id 6611 and first name "Captain"
    And a Discord server "6601" named "Settings Server" with channels "66011" named "general" and "66012" named "cs"
    And Discord channel "66011" is linked to the chat
    And Discord channel "66012" is linked to the chat

  Scenario: the chat settings commands are offered to server managers only
    Then Discord server "6601" offers the "/github_notify" slash command to server managers only
    And Discord server "6601" offers the "/steam_updates" slash command to server managers only
    And Discord server "6601" offers the "/unlink_chat" slash command to server managers only

  Scenario: a server manager turns on GitHub notifications for the group
    When Discord user "mod_cs" named "Mod" with id "660100000000000001" who manages the server runs "/github_notify" with setting "on" in channel "66011"
    Then Discord channel "66011" receives a bot message
      """
      GitHub notifications for this chat have been turned on.
      """
    And the bot replies "GitHub notifications for this chat have been turned on."
    When a commit "c0ffee9" with message "From Discord" is pushed to GitHub
    Then chat 6601 receives a GitHub notification containing "From Discord"

  Scenario: GitHub notifications need on or off
    When Discord user "mod_cs" named "Mod" with id "660100000000000001" who manages the server runs "/github_notify" in channel "66011"
    Then Discord channel "66011" receives a bot message containing "to enable or disable GitHub notifications for this chat"

  Scenario: a server manager turns off Steam updates for the group
    When Discord user "mod_cs" named "Mod" with id "660100000000000001" who manages the server runs "/steam_updates" with setting "off" in channel "66011"
    Then Discord channel "66011" receives a bot message
      """
      Steam updates for this chat have been turned off.
      """
    And the bot replies "Steam updates for this chat have been turned off."

  Scenario: someone who cannot manage the server is turned away
    When Discord user "alice" named "Alice" with id "660100000000000002" runs "/github_notify" with setting "on" in channel "66011"
    Then Discord channel "66011" receives a bot message
      """
      Only someone who can manage this server can use this command.
      """
    And the bot sends no reply
    When Discord user "alice" named "Alice" with id "660100000000000002" runs "/unlink_chat" in channel "66011"
    Then Discord channel "66011" receives a bot message
      """
      Only someone who can manage this server can use this command.
      """
    And Discord server "6601" offers the "/rollcall" slash command

  Scenario: a server manager unlinks the channel the command is given in
    When Discord user "mod_cs" named "Mod" with id "660100000000000001" who manages the server runs "/unlink_chat" in channel "66011"
    Then Discord channel "66011" receives a bot message containing "no longer linked"
    And Discord channel "66011" receives a bot message
      """
      Unlinked Discord channel 66011.
      """
    And the relay webhook of channel "66011" is gone
    When the user sends "/rollcall"
    Then Discord channel "66012" receives a bot message containing "🙋‍♂️ Captain"

  Scenario: a server manager unlinks another channel of the server
    When Discord user "mod_cs" named "Mod" with id "660100000000000001" who manages the server runs "/unlink_chat" with channel "66012" in channel "66011"
    Then Discord channel "66011" receives a bot message
      """
      Unlinked Discord channel 66012.
      """
    And Discord channel "66012" receives a bot message containing "no longer linked"

  Scenario: a server manager cannot unlink a channel of another server
    Given a Discord server "6602" named "Other Server" with channel "66021" named "general"
    And Discord channel "66021" is linked to the chat
    When Discord user "mod_cs" named "Mod" with id "660100000000000001" who manages the server runs "/unlink_chat" with channel "66021" in channel "66011"
    Then Discord channel "66011" receives a bot message
      """
      That channel is not linked to this group.
      """
    And Discord server "6602" offers the "/rollcall" slash command
