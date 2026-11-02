Feature: relaying replies
  A reply stays a reply everywhere: on Telegram it answers the relayed copy, and on Discord, where
  relayed messages can't be real replies, it opens with a link to the message it answers.

  Background:
    Given a chat with id 8601
    And a user with id 8611 and first name "Tester"
    And a Discord server "8601" named "Reply One" with channel "86011" named "general"
    And a Discord server "8602" named "Reply Two" with channel "86021" named "cs"
    And a Discord server "8603" named "Reply Plain" with channel "86031" named "general" where the bot lacks "Manage Webhooks"
    And Discord channel "86011" is linked to the chat
    And Discord channel "86021" is linked to the chat
    And Discord channel "86031" is linked to the chat

  Scenario: a Telegram reply to a Telegram message links the copy it answers
    When the user sends "who's on tonight?"
    Then Discord channel "86011" receives "who's on tonight?" from "Tester"
    When the user replies "me at least" to that message
    Then Discord channel "86011" receives "me at least" from "Tester" replying to "who's on tonight?" by "Tester"
    And Discord channel "86031" receives "me at least" from "Tester" replying to "who's on tonight?" by "Tester"

  Scenario: a Telegram reply to a Discord message links the original and its copies
    When Discord user "alice" named "Alice" with id "860100000000000001" says "anyone up?" in channel "86011"
    Then the bot replies "alice: anyone up?"
    When the latest bot message is remembered
    And the user replies "yes" to the remembered message
    Then Discord channel "86011" receives "yes" from "Tester" replying to "anyone up?" by "alice"
    And Discord channel "86021" receives "yes" from "Tester" replying to "anyone up?" by "alice"

  Scenario: a Discord reply answers the Telegram copy and links the other channels' copy
    When the user sends "map vote?"
    Then Discord channel "86011" receives "map vote?" from "Tester"
    When Discord user "alice" named "Alice" with id "860100000000000001" replies "mirage" to "map vote?" in channel "86011"
    Then the bot relays "alice: mirage" as a reply to that message
    And Discord channel "86021" receives "mirage" from "alice" replying to "map vote?" by "Tester"

  Scenario: a Discord reply to a Discord message answers its Telegram copy
    When Discord user "bob" named "Bob" with id "860100000000000002" says "gg" in channel "86021"
    Then the bot replies "bob: gg"
    When the latest bot message is remembered
    And Discord user "alice" named "Alice" with id "860100000000000001" replies "wp" to "gg" in channel "86011"
    Then the bot relays "alice: wp" as a reply to the remembered message

  Scenario: an edited reply keeps its link
    When the user sends "start at 9?"
    Then Discord channel "86011" receives "start at 9?" from "Tester"
    When the user replies "or 10" to that message
    Then Discord channel "86011" receives "or 10" from "Tester" replying to "start at 9?" by "Tester"
    When the user edits that message to "or half 10"
    Then Discord channel "86011" sees its copy edited to "or half 10" from "Tester" replying to "start at 9?" by "Tester"
    And Discord channel "86031" sees its copy edited to "or half 10" from "Tester" replying to "start at 9?" by "Tester"
