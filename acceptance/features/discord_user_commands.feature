Feature: linking users and managing the rotation from Discord
  People who can manage a linked Discord server link and unlink users with slash commands. Anyone
  in a linked channel adds and removes rotation players, naming them by Telegram or Discord username.

  Background:
    Given a chat with id 6701
    And a user with id 6711 and first name "Captain"
    And the user is an admin of the chat
    And a Discord server "6701" named "Users Server" with channel "67011" named "general" and member "wren_cs" named "Wren" with id "670100000000000001"
    And Discord channel "67011" is linked to the chat

  Scenario: linking users is offered to server managers only, the rotation to everyone
    Then Discord server "6701" offers the "/link_user" slash command to server managers only
    And Discord server "6701" offers the "/unlink_user" slash command to server managers only
    And Discord server "6701" offers the "/rollcall_add_player" slash command
    And Discord server "6701" offers the "/rollcall_remove_player" slash command

  Scenario: a server manager links and unlinks a Telegram user and a Discord member
    When user 6712 sends "/hi"
    Then the bot replies "Hello to you too, User6712!"
    When Discord user "mod_cs" named "Mod" with id "670100000000000002" who manages the server runs "/link_user" with the options "user=@user6712, discord=wren_cs" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Linked User6712 to Discord user wren\_cs.
      """
    And the bot replies "Linked User6712 to Discord user wren_cs."
    When Discord user "mod_cs" named "Mod" with id "670100000000000002" who manages the server runs "/unlink_user" with discord "wren_cs" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Unlinked User6712 from Discord user wren\_cs.
      """
    When Discord user "mod_cs" named "Mod" with id "670100000000000002" who manages the server runs "/unlink_user" with user "user6712" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      User6712 is not linked to a Discord user.
      """

  Scenario: linking needs both users
    When Discord user "mod_cs" named "Mod" with id "670100000000000002" who manages the server runs "/link_user" with discord "wren_cs" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Name the Telegram user with the user option and the Discord user with the discord option.
      """

  Scenario: someone who cannot manage the server cannot link users
    When user 6712 sends "/hi"
    Then the bot replies "Hello to you too, User6712!"
    When Discord user "alice" named "Alice" with id "670100000000000003" runs "/link_user" with discord "wren_cs" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Only someone who can manage this server can use this command.
      """

  Scenario: players are added to and removed from the rotation from Discord
    When user 6712 sends "/hi"
    Then the bot replies "Hello to you too, User6712!"
    When Discord user "alice" named "Alice" with id "670100000000000003" runs "/rollcall_add_player" with user "user6712" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Added 1 players to rollcall.
      """
    When Discord user "alice" named "Alice" with id "670100000000000003" runs "/rollcall_add_player" with discord "wren_cs" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Added 1 players to rollcall.
      """
    When the user sends "/rollcall_get_players"
    Then the bot reply contains "User6712"
    And the bot reply contains "wren_cs"
    When Discord user "alice" named "Alice" with id "670100000000000003" runs "/rollcall_remove_player" with discord "wren_cs" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Poof! They're gone!
      """
    When the user sends "/rollcall_get_players"
    Then the bot reply does not contain "wren_cs"

  Scenario: a player must be named on Discord
    When Discord user "alice" named "Alice" with id "670100000000000003" runs "/rollcall_add_player" in channel "67011"
    Then Discord channel "67011" receives a bot message
      """
      Name a player with the user or discord option.
      """
