Feature: rollcall player menus
  /rollcall_add_player and /rollcall_remove_player without a name offer a menu of the people to
  pick from, Telegram and Discord users alike.

  Background:
    Given a chat with id 9701
    And a user with id 9711 and first name "Captain"
    And the user is an admin of the chat
    And a Discord server "9701" named "Menus" with channel "97011" named "general"
    And Discord channel "97011" is linked to the chat

  Scenario: players are added and removed from the menus
    When user 9712 sends "/hi"
    Then the bot replies "Hello to you too, User9712!"
    When Discord user "nia_cs" named "Nia" with id "970100000000000001" runs "/hi" in channel "97011"
    Then the bot replies "Hello to you too, nia_cs!"
    When the user sends "/rollcall_add_player"
    Then the bot replies "Who would you like to add?"
    And the bot reply offers the buttons "Captain (@captain)", "nia_cs (Discord)", "User9712 (@user9712)"
    When user 9712 named "User9712" taps the button containing "nia_cs"
    Then the bot replies "Added nia_cs to the rollcall."
    And Discord channel "97011" receives a bot message containing "Added nia\_cs to the rollcall."
    When the user sends "/rollcall_add_player"
    Then the bot reply offers the buttons "Captain (@captain)", "User9712 (@user9712)"
    When user 9711 named "Captain" taps the button containing "User9712"
    Then the bot replies "Added User9712 to the rollcall."
    When the user sends "/rollcall_remove_player"
    Then the bot replies "Who would you like to remove?"
    And the bot reply offers the buttons "nia_cs (Discord)", "User9712"
    When user 9711 named "Captain" taps the button containing "nia_cs"
    Then the bot replies "Removed nia_cs from the rollcall."
    And Discord channel "97011" receives a bot message containing "Removed nia\_cs from the rollcall."
    When the user sends "/rollcall_get_players"
    Then the bot reply contains "User9712"
    And the bot reply does not contain "nia_cs"

  Scenario: a menu left open does not add someone twice
    Given a chat with id 9702
    When the user sends "/rollcall_add_player"
    Then the bot reply offers the buttons "Captain (@captain)"
    When user 9711 named "Captain" taps the button containing "Captain"
    Then the bot replies "Added Captain to the rollcall."
    When user 9711 named "Captain" taps the button containing "Captain"
    Then the bot replies "Captain is already in the rollcall."
    When the user sends "/rollcall_add_player"
    Then the bot replies "Everyone I know here is already in the rollcall."

  Scenario: there is nobody to remove from an empty rollcall
    Given a chat with id 9703
    When the user sends "/rollcall_remove_player"
    Then the bot replies "No players in the rollcall."
