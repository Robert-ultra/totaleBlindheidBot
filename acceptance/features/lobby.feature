Feature: full lobbies and the waitlist
  Once LOBBY_SIZE (5) people said yes to a rollcall, the lobby is announced full. Anyone saying yes
  after that is waitlisted in the order they said yes, and is pinged when a spot opens up.

  Background:
    Given a chat with id 13001
    And a user with id 13101 and first name "Captain"
    When the user sends "/rollcall"
    Then the bot reply contains "🙋‍♂️ Captain"
    When the RSVP message is remembered
    And the latest bot message is remembered
    And user 13102 named "Bea" taps yes
    Then the bot reply contains "🙋‍♂️ Captain Bea"
    When user 13103 named "Cid" taps yes
    Then the bot reply contains "🙋‍♂️ Captain Bea Cid"
    When user 13104 named "Dee" taps yes
    Then the bot reply contains "🙋‍♂️ Captain Bea Cid Dee"

  Scenario: the fifth yes fills the lobby, and it is announced once
    When user 13105 named "Eve" taps yes
    Then the bot posts a message starting with "Lobby full!"
    And the bot reply links "Eve" to "tg://user?id=13105"
    When user 13106 named "Fay" taps yes
    Then the bot reply contains "🙋‍♂️ Captain Bea Cid Dee Eve"
    And the bot reply contains "⏳ Waitlist: Fay"
    And the bot posts no message starting with "Lobby full!"

  Scenario: the first waitlisted player is pinged when a spot opens up
    When user 13105 named "Eve" taps yes
    Then the bot posts a message starting with "Lobby full!"
    When user 13106 named "Fay" taps yes
    Then the bot reply contains "⏳ Waitlist: Fay"
    When user 13107 named "Gus" taps yes
    Then the bot reply contains "⏳ Waitlist: Fay Gus"
    When user 13102 named "Bea" taps no
    Then the bot posts a message starting with "A spot opened up, you're in: "
    And the bot reply links "Fay" to "tg://user?id=13106"
    And the remembered message is edited to contain "🙋‍♂️ Captain Cid Dee Eve Fay"
    And the remembered message is edited to contain "⏳ Waitlist: Gus" and not "Fay Gus"

  Scenario: saying yes again keeps your place in the queue
    When user 13105 named "Eve" taps yes
    Then the bot posts a message starting with "Lobby full!"
    When user 13106 named "Fay" taps yes
    Then the bot reply contains "⏳ Waitlist: Fay"
    When user 13107 named "Gus" taps yes
    Then the bot reply contains "⏳ Waitlist: Fay Gus"
    When user 13106 named "Fay" taps yes
    Then the bot posts no message starting with "A spot opened up"
    When user 13102 named "Bea" taps no
    Then the bot posts a message starting with "A spot opened up, you're in: "
    And the bot reply links "Fay" to "tg://user?id=13106"
