Feature: relaying deletions
  Deleting a relayed Discord message deletes its copies everywhere. Telegram does not tell bots
  about deleted messages, so deletions on Telegram stay on Telegram.

  Background:
    Given a chat with id 8501
    And a user with id 8511 and first name "Tester"
    And a Discord server "8501" named "Delete One" with channel "85011" named "general"
    And a Discord server "8502" named "Delete Two" with channel "85021" named "cs"
    And a Discord server "8503" named "Delete Plain" with channel "85031" named "general" where the bot lacks "Manage Webhooks"
    And Discord channel "85011" is linked to the chat
    And Discord channel "85021" is linked to the chat
    And Discord channel "85031" is linked to the chat

  Scenario: deleting a Discord message deletes its copies everywhere
    When Discord user "alice" named "Alice" with id "850100000000000001" says "oops wrong chat" in channel "85011"
    Then the bot replies "alice: oops wrong chat"
    When that Discord message is deleted
    Then the bot deletes its 1 copy
    And Discord channel "85021" sees its copy deleted
    And Discord channel "85031" sees its copy deleted

  Scenario: deleting a Discord image deletes the photo on Telegram
    When Discord user "alice" named "Alice" with id "850100000000000001" sends an image "a.png" saying "two shots" in channel "85011"
    Then the bot sends a photo "a.png" with caption "alice: two shots"
    When that Discord message is deleted
    Then the bot deletes its 1 copy
    And Discord channel "85021" sees its copy deleted

  Scenario: deleting a copy leaves the original and the other copies alone
    When the user sends "keep this"
    Then Discord channel "85011" receives "keep this" from "Tester"
    When someone deletes the copy in Discord channel "85021"
    Then the bot deletes nothing
    And Discord channel "85011" receives nothing
    And Discord channel "85031" receives nothing
