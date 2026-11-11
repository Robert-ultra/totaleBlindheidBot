Feature: relaying tags between Telegram and Discord
  Someone tagged on one platform is tagged on the other too when their Telegram and Discord accounts
  are linked; anyone else is relayed by name, as before.

  Background:
    Given a chat with id 8121
    And a user with id 8122 and first name "Tester"
    And a Discord server "8121" named "Tag Server" with channel "81211" named "general" and member "bea" named "Bea" with id "812100000000000001"
    And Discord channel "81211" is linked to the chat
    When user 8123 sends "/hi"
    Then the bot reply starts with "Hello to you too"
    When the user sends "/link_user user8123 bea"
    Then the bot reply contains "to Discord user bea."

  Scenario: a Discord tag of a linked user tags them on Telegram
    When Discord user "alice" named "Alice" with id "812100000000000002" says "<@812100000000000001> you coming?" in channel "81211" mentioning user "812100000000000001" named "Bea"
    Then the bot replies "alice: @User8123 you coming?"
    And the bot reply links "@User8123" to "tg://user?id=8123"

  Scenario: a Discord tag of an unlinked user stays a name
    When Discord user "alice" named "Alice" with id "812100000000000002" says "<@812100000000000003> you coming?" in channel "81211" mentioning user "812100000000000003" named "Cas"
    Then the bot replies "alice: @Cas you coming?"

  Scenario: a typed Telegram username of a linked user tags them on Discord
    When the user sends "@user8123 you coming?" typing the username "@user8123"
    Then Discord channel "81211" receives "<@812100000000000001> you coming?" from "Tester"

  Scenario: a tapped Telegram mention of a linked user tags them on Discord
    When the user sends "User8123 you coming?" mentioning user 8123 as "User8123"
    Then Discord channel "81211" receives "<@812100000000000001> you coming?" from "Tester"

  Scenario: a Telegram username of someone without Discord stays text
    When the user sends "@stranger you coming?" typing the username "@stranger"
    Then Discord channel "81211" receives "@stranger you coming?" from "Tester"

  Scenario: a Telegram edit tags a linked user on Discord
    When the user sends "anyone coming?"
    Then Discord channel "81211" receives "anyone coming?" from "Tester"
    When the user edits that message to "@user8123 coming?" typing the username "@user8123"
    Then Discord channel "81211" sees its copy edited to "<@812100000000000001> coming?"

  Scenario: a Discord edit tags a linked user on Telegram
    When Discord user "alice" named "Alice" with id "812100000000000002" says "anyone coming?" in channel "81211"
    Then the bot replies "alice: anyone coming?"
    When that Discord message is edited to "<@812100000000000001> coming?"
    Then the bot edits its copy to "alice: @User8123 coming?"
