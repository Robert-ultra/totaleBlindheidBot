Feature: relaying edits
  Editing a relayed message edits its copies on the other platforms, so the conversation stays the
  same everywhere.

  Background:
    Given a chat with id 8401
    And a user with id 8411 and first name "Tester"
    And a Discord server "8401" named "Edit One" with channel "84011" named "general"
    And a Discord server "8402" named "Edit Two" with channel "84021" named "cs"
    And a Discord server "8403" named "Edit Plain" with channel "84031" named "general" where the bot lacks "Manage Webhooks"
    And Discord channel "84011" is linked to the chat
    And Discord channel "84021" is linked to the chat
    And Discord channel "84031" is linked to the chat

  Scenario: a Telegram edit reaches every linked channel
    When the user sends "see you at 9"
    Then Discord channel "84011" receives "see you at 9" from "Tester"
    When the user edits that message to "see you at 10"
    Then Discord channel "84011" sees its copy edited to "see you at 10"
    And Discord channel "84021" sees its copy edited to "see you at 10"
    And Discord channel "84031" sees its copy edited to "**Tester:** see you at 10"

  Scenario: a Discord edit reaches Telegram and the other channels
    When Discord user "alice" named "Alice" with id "840100000000000001" says "gg wp" in channel "84011"
    Then the bot replies "alice: gg wp"
    When that Discord message is edited to "gg wp all"
    Then the bot edits its copy to "alice: gg wp all"
    And Discord channel "84021" sees its copy edited to "gg wp all"
    And Discord channel "84031" sees its copy edited to "**alice:** gg wp all"

  Scenario: editing a Discord image's text edits the Telegram caption
    When Discord user "alice" named "Alice" with id "840100000000000001" sends an image "map.png" saying "this spot" in channel "84011"
    Then the bot sends a photo "map.png" with caption "alice: this spot"
    When that Discord message is edited to "this spot here"
    Then the bot edits its copy to "alice: this spot here"

  Scenario: an edit to a message from before the channel was linked changes nothing
    Given a chat with id 8402
    And a user with id 8412 and first name "Early"
    When the user sends "before the bridge"
    Given a Discord server "8404" named "Late" with channel "84041" named "general"
    And Discord channel "84041" is linked to the chat
    When the user edits that message to "after the bridge"
    Then Discord channel "84041" receives nothing
