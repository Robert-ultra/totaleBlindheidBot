Feature: Steam presence markers on the Discord copies of rollcall, schedule and wingman tags
  The Discord copy of a tagged message shows the same presence markers as the Telegram one, follows
  their updates and loses them when they are stripped.
  Each example uses its own chat, users, Steam ids and Discord channel since app data persists.

  Scenario Outline: <command> prefixes each tag on Discord with the player's presence
    Given a chat with id <chat>
    And a user with id <id>0 and first name "Captain"
    And the user is an admin of the chat
    And a Discord server "<chat>" named "Markers" with channel "<chat>1" named "general" and member "alice_cs" named "Alice" with id "<chat>00000000000001"
    And Discord channel "<chat>1" is linked to the chat
    When user <id>1 sends "/steam_user_id 7656119800000<id>1"
    Then the bot replies "Your Steam user ID(s) has been set to 7656119800000<id>1"
    When user <id>2 sends "/steam_user_id 7656119800000<id>2"
    Then the bot replies "Your Steam user ID(s) has been set to 7656119800000<id>2"
    When user <id>3 sends "/steam_user_id 7656119800000<id>3"
    Then the bot replies "Your Steam user ID(s) has been set to 7656119800000<id>3"
    When the user sends "/link_user @user<id>1 discord:alice_cs"
    Then the bot replies "Linked User<id>1 to Discord user alice_cs."
    When Steam mappings are refreshed
    And Steam reports user "7656119800000<id>2" online but not playing
    And Steam reports user "7656119800000<id>3" offline
    And Steam reports user "7656119800000<id>1" playing CS2
    Then chat <chat> receives a Steam message containing "is playing Counter-Strike"
    When the user sends "/rollcall_add_player Alice" mentioning user <id>1 as "Alice"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/rollcall_add_player Bob" mentioning user <id>2 as "Bob"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/rollcall_add_player Carol" mentioning user <id>3 as "Carol"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/rollcall_add_player Dave" mentioning user <id>4 as "Dave"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "<command>"
    Then the bot reply contains "🟢Alice 🟡Bob 🔴Carol 😶‍🌫️Dave"
    And Discord channel "<chat>1" receives a bot message containing "🟢<@<chat>00000000000001> 🟡Bob 🔴Carol 😶‍🌫️Dave"

    Examples:
      | command           | chat | id  |
      | /rollcall         | 7021 | 794 |
      | /schedule 3 hours | 7022 | 795 |
      | /wingman          | 7023 | 796 |

  Scenario Outline: <command> keeps its Discord presence markers up to date, then strips them
    Given a chat with id <chat>
    And a Discord server "<chat>" named "Markers" with channel "<chat>1" named "general"
    And Discord channel "<chat>1" is linked to the chat
    When user <id>1 sends "/steam_user_id 7656119800000<id>1"
    Then the bot replies "Your Steam user ID(s) has been set to 7656119800000<id>1"
    When Steam mappings are refreshed
    And Steam reports user "7656119800000<id>1" online but not playing
    Given a user with id <id>0 and first name "Captain"
    When the user sends "/rollcall_add_player Alice" mentioning user <id>1 as "Alice"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "<command>"
    Then Discord channel "<chat>1" receives a bot message containing "🟡Alice"
    When the latest bot message in Discord channel "<chat>1" is remembered
    And Steam reports user "7656119800000<id>1" playing CS2
    Then the remembered Discord message is edited to contain "🟢Alice"
    When Steam reports user "7656119800000<id>1" offline
    Then the remembered Discord message is edited to contain "🔴Alice"
    When the presence markers' live window has passed
    Then the remembered Discord message is edited to contain "Alice" without a presence marker

    Examples:
      | command           | chat | id  |
      | /rollcall         | 7031 | 797 |
      | /schedule 3 hours | 7032 | 798 |
      | /wingman          | 7033 | 799 |

  Scenario: cancelling a schedule strips the Discord presence markers along with its buttons
    Given a chat with id 7034
    And a Discord server "7034" named "Markers" with channel "70341" named "general"
    And Discord channel "70341" is linked to the chat
    And a user with id 7900 and first name "Captain"
    When the user sends "/rollcall_add_player Alice" mentioning user 7901 as "Alice"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/schedule 3 hours"
    Then Discord channel "70341" receives a bot message containing "😶‍🌫️Alice"
    When the latest bot message in Discord channel "70341" is remembered
    And the user sends "/cancel"
    Then the bot replies "Scheduled rollcall cancelled."
    And the remembered Discord message is edited to contain "Alice" without a presence marker
