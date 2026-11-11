Feature: relaying tags between Discord servers
  A tag relayed to another Discord server stays a tag when the tagged person is on that server too;
  otherwise it becomes their name, since Discord cannot show or ping them there.

  Background:
    Given a chat with id 8131
    And a user with id 8132 and first name "Tester"
    And a Discord server "8131" named "Tag One" with channel "81311" named "general" and member "bea" named "Bea" with id "813100000000000001"
    And a Discord server "8132" named "Tag Two" with channel "81321" named "general" and member "dan" named "Dan" with id "813100000000000002"
    And Discord channel "81311" is linked to the chat
    And Discord channel "81321" is linked to the chat

  Scenario: a tag of someone on both servers stays a tag
    When Discord user "alice" named "Alice" with id "813100000000000003" says "<@813100000000000002> hi" in channel "81311" mentioning user "813100000000000002" named "Dan"
    Then Discord channel "81321" receives "<@813100000000000002> hi" from "alice"

  Scenario: a tag of someone not on the other server becomes their name
    When Discord user "alice" named "Alice" with id "813100000000000003" says "<@813100000000000001> hi" in channel "81311" mentioning user "813100000000000001" named "Bea"
    Then Discord channel "81321" receives "@Bea hi" from "alice"

  Scenario: an edit tagging someone not on the other server shows their name there
    When Discord user "alice" named "Alice" with id "813100000000000003" says "anyone coming?" in channel "81311"
    Then Discord channel "81321" receives "anyone coming?" from "alice"
    When that Discord message is edited to "<@813100000000000001> coming?"
    Then Discord channel "81321" sees its copy edited to "@Bea coming?"

  Scenario: a Telegram tag of a linked user is a tag only where they are a member
    When user 8133 sends "/hi"
    Then the bot reply starts with "Hello to you too"
    When the user sends "/link_user user8133 bea"
    Then the bot reply contains "to Discord user bea."
    When the user sends "@user8133 you coming?" typing the username "@user8133"
    Then Discord channel "81311" receives "<@813100000000000001> you coming?" from "Tester"
    And Discord channel "81321" receives "@Bea you coming?" from "Tester"
