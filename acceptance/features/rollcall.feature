Feature: rollcall command
  The bot rallies the troops with a random battle cry.

  Scenario: rollcall replies with one of the known quotes
    Given a chat with id 1200
    And a user with id 5200 and first name "Tester"
    When the user sends "/rollcall"
    Then the bot reply first line is one of
      | quote                                                  |
      | Are we rushin' in, or are we going' sneaky-beaky like? |
      | Bingo, bango, bongo, bish, bash, bosh!                 |
      | Easy peasy, lemon squeezy!                             |
      | Grab your gear and let's go!                           |
      | RUSH B DON'T STOP                                      |

  Scenario: rollcall followed by text that isn't a time is still a rollcall
    Given a chat with id 1201
    And a user with id 5201 and first name "Tester"
    When the user sends "/rollcall lets go"
    Then the bot reply first line is one of
      | quote                                                  |
      | Are we rushin' in, or are we going' sneaky-beaky like? |
      | Bingo, bango, bongo, bish, bash, bosh!                 |
      | Easy peasy, lemon squeezy!                             |
      | Grab your gear and let's go!                           |
      | RUSH B DON'T STOP                                      |
    And the bot reply offers a "Joining" button

  Scenario Outline: rollcall followed by a time schedules the rollcall
    Given a chat with id <chat_id>
    And a user with id <user_id> and first name "Tester"
    When the user sends "/rollcall <time>"
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot reply offers a "I'm in" button
    When the user sends "/cancel"
    Then the bot replies "Scheduled rollcall cancelled."

    Examples:
      | chat_id | user_id | time    |
      | 1202    | 5202    | 3 hours |
      | 1203    | 5203    | 2       |
      | 1204    | 5204    | in 90m  |

  Scenario Outline: rollcall followed by a time is validated like a schedule
    Given a chat with id <chat_id>
    And a user with id <user_id> and first name "Tester"
    When the user sends "/rollcall <time>"
    Then the bot replies "<reply>"

    Examples:
      | chat_id | user_id | time     | reply                                                       |
      | 1205    | 5205    | 1 minute | Rollcall must be scheduled at least 2 minutes in advance.   |
      | 1206    | 5206    | 13 hours | Rollcall cannot be scheduled more than 12 hours in advance. |

  Scenario: rollcall with a time uses the user's timezone
    Given a chat with id 1207
    And a user with id 5207 and first name "Tester"
    When the user sends "/timezone UTC+2"
    Then the bot replies "Your timezone has been set to +02:00"
    When the user sends "/rollcall 3 hours"
    Then the bot reply shows "GMT+2" as a "wt" date-time 3 hours ahead
