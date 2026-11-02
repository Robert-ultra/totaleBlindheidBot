Feature: relaying Discord threads
  A message in a thread of a linked channel is relayed as a reply to the message the thread was
  started on: a real reply on Telegram, and a reply link in the other Discord channels.

  Background:
    Given a chat with id 8801
    And a user with id 8811 and first name "Tester"
    And a Discord server "8801" named "Thread One" with channel "88011" named "general"
    And a Discord server "8802" named "Thread Two" with channel "88021" named "cs"
    And Discord channel "88011" is linked to the chat
    And Discord channel "88021" is linked to the chat

  Scenario: a thread on a Telegram message answers it on Telegram
    When the user sends "map vote?"
    Then Discord channel "88011" receives "map vote?" from "Tester"
    When Discord user "alice" named "Alice" with id "880100000000000001" starts a thread "maps" on "map vote?" in channel "88011"
    Then the bot has joined that thread
    And the bot sends no reply
    When Discord user "alice" named "Alice" with id "880100000000000001" says "mirage" in that thread
    Then the bot relays "alice: mirage" as a reply to that message
    And Discord channel "88021" receives "mirage" from "alice" replying to "map vote?" by "Tester"

  Scenario: a thread on a Discord message answers its Telegram copy
    When Discord user "bob" named "Bob" with id "880100000000000002" says "gg" in channel "88021"
    Then the bot replies "bob: gg"
    When the latest bot message is remembered
    And Discord user "alice" named "Alice" with id "880100000000000001" starts a thread "post-game" on "gg" in channel "88021"
    And Discord user "alice" named "Alice" with id "880100000000000001" says "wp" in that thread
    Then the bot relays "alice: wp" as a reply to the remembered message

  Scenario: an edit in a thread reaches its Telegram copy
    When the user sends "start at 9?"
    Then Discord channel "88011" receives "start at 9?" from "Tester"
    When Discord user "alice" named "Alice" with id "880100000000000001" starts a thread "time" on "start at 9?" in channel "88011"
    And Discord user "alice" named "Alice" with id "880100000000000001" says "or 10" in that thread
    Then the bot relays "alice: or 10" as a reply to that message
    When that Discord message is edited to "or half 10"
    Then the bot edits its copy to "alice: or half 10"

  Scenario: a thread in a channel that is not linked goes nowhere
    Given a Discord server "8803" named "Elsewhere" with channel "88031" named "general"
    When Discord user "bob" named "Bob" with id "880100000000000002" says "off topic" in channel "88031"
    And Discord user "alice" named "Alice" with id "880100000000000001" starts a thread "side" on "off topic" in channel "88031"
    And Discord user "alice" named "Alice" with id "880100000000000001" says "hi" in that thread
    Then the bot sends no reply
