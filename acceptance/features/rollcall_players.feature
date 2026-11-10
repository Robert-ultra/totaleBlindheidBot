Feature: rollcall player management
  Admins manage the list of players included in a rollcall.

  Scenario: adding without arguments prompts for a name
    Given a chat with id 3001
    And a user with id 5701 and first name "Admin"
    When the user sends "/rollcall_add_player"
    Then the bot replies "Who would you like to add?"

  Scenario: a name nobody is known by cannot be added
    Given a chat with id 3002
    And a user with id 5702 and first name "Admin"
    When the user sends "/rollcall_add_player Charlie"
    Then the bot replies "I don't know Charlie."

  Scenario: duplicate arguments are rejected
    Given a chat with id 3003
    And a user with id 5703 and first name "Admin"
    When the user sends "/rollcall_add_player Bob Bob" mentioning 2 users
    Then the bot replies "Seems you've got some duplicate entries in there, bud!"

  Scenario: removing an unknown player
    Given a chat with id 3004
    And a user with id 5704 and first name "Admin"
    When the user sends "/rollcall_remove_player Ghost" mentioning user 888 as "Ghost"
    Then the bot replies "Who are they?"

  Scenario: removing a name that is not in the rollcall
    Given a chat with id 3006
    And a user with id 5706 and first name "Admin"
    When the user sends "/rollcall_remove_player Ghost"
    Then the bot replies "Who are they?"

  Scenario: a Telegram user is added and removed by bare username
    Given a chat with id 3007
    And a user with id 5707 and first name "Admin"
    When user 5717 sends "/hi"
    Then the bot replies "Hello to you too, User5717!"
    When the user sends "/rollcall_add_player user5717"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/rollcall_get_players"
    Then the bot reply contains "User5717"
    When the user sends "/rollcall_add_player User5717" mentioning user 5717 as "User5717"
    Then the bot reply contains "already in the rollcall"
    When the user sends "/rollcall_remove_player user5717"
    Then the bot replies "Poof! They're gone!"
    When the user sends "/rollcall_get_players"
    Then the bot replies "No players in the rollcall."

  Scenario: full add, list, duplicate-guard and remove lifecycle
    Given a chat with id 3005
    And a user with id 5705 and first name "Admin"
    When the user sends "/rollcall_get_players"
    Then the bot replies "No players in the rollcall."
    When the user sends "/rollcall_add_player Alice" mentioning user 777 as "Alice"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/rollcall_get_players"
    Then the bot reply contains "Alice"
    When the user sends "/rollcall_add_player Alice" mentioning user 777 as "Alice"
    Then the bot reply contains "already in the rollcall"
    When the user sends "/rollcall_remove_player Alice" mentioning user 777 as "Alice"
    Then the bot replies "Poof! They're gone!"
    When the user sends "/rollcall_get_players"
    Then the bot replies "No players in the rollcall."
