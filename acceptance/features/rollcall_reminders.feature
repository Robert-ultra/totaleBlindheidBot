Feature: rollcall reminders and auto-cancel
  REMINDER_MINUTES (15) before a scheduled rollcall, the bot pings rotation players who haven't
  answered and anyone who said maybe. With /auto_cancel on, a rollcall that is still short of a
  full lobby by then is cancelled instead.

  Scenario: the reminder pings the undecided, not those who answered yes or no
    Given a chat with id 14001
    And a user with id 14101 and first name "Captain"
    When the user sends "/rollcall_add_player Alice" mentioning user 14777 as "Alice"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/rollcall_add_player Bob" mentioning user 14778 as "Bob"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When the RSVP message is remembered
    And user 14102 named "Mia" taps maybe
    Then the bot reply contains "🤷‍♂️ Mia"
    When user 14778 named "Bob" taps no
    Then the bot reply contains "🙅‍♂️ Bob"
    When the scheduled rollcall is 10 minutes away
    Then the bot posts a message starting with "Rollcall in 10 minutes! Still waiting on: "
    And the bot reply links "Alice" to "tg://user?id=14777"
    And the bot reply links "Mia" to "tg://user?id=14102"
    And the bot reply does not contain "Bob"
    And the bot reply does not contain "Captain"
    And the bot posts only one message starting with "Rollcall in"

  Scenario: the reminder reaches linked Discord channels
    Given a chat with id 14002
    And a user with id 14201 and first name "Captain"
    And a Discord server "14002" named "Server One" with channel "140021" named "general"
    And Discord channel "140021" is linked to the chat
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When the latest bot message in Discord channel "140021" is remembered
    And Discord user "kit_cs" named "Kit" with id "140020000000000002" taps "rsvp:maybe" on the remembered Discord message
    Then the remembered Discord message is edited to contain "🤷‍♂️ kit\_cs"
    When the scheduled rollcall is 10 minutes away
    Then Discord channel "140021" receives a bot message containing "Still waiting on: <@140020000000000002>"

  Scenario: only an admin can turn auto-cancel on
    Given a chat with id 14003
    And a user with id 14301 and first name "Tester"
    When the user sends "/auto_cancel on"
    Then the bot replies "Only a group admin can change auto-cancel."

  Scenario: auto-cancel needs on or off
    Given a chat with id 14004
    And a user with id 14401 and first name "Tester"
    And the user is an admin of the chat
    When the user sends "/auto_cancel maybe"
    Then the bot replies "Usage: /auto_cancel on|off"

  Scenario: with auto-cancel on, a rollcall short of a full lobby is cancelled at reminder time
    Given a chat with id 14005
    And a user with id 14501 and first name "Captain"
    And the user is an admin of the chat
    When the user sends "/auto_cancel on"
    Then the bot replies "Auto-cancel for this chat has been turned on."
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When the RSVP message is remembered
    And the scheduled rollcall is 10 minutes away
    Then the bot posts a message starting with "Rollcall cancelled: only 1 of 5 said yes."
    And no rollcall is scheduled for the chat
    When user 14502 named "Mia" taps yes
    Then the tap is answered with "This RSVP has expired."

  Scenario: with auto-cancel off again, the reminder is sent instead
    Given a chat with id 14006
    And a user with id 14601 and first name "Captain"
    And the user is an admin of the chat
    When the user sends "/auto_cancel on"
    Then the bot replies "Auto-cancel for this chat has been turned on."
    When the user sends "/auto_cancel off"
    Then the bot replies "Auto-cancel for this chat has been turned off."
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When the RSVP message is remembered
    And user 14602 named "Mia" taps maybe
    Then the bot reply contains "🤷‍♂️ Mia"
    When the scheduled rollcall is 10 minutes away
    Then the bot posts a message starting with "Rollcall in 10 minutes! Still waiting on: "

  Scenario: a rollcall scheduled inside the reminder window gets no reminder
    Given a chat with id 14008
    And a user with id 14801 and first name "Captain"
    When the user sends "/rollcall_add_player Alice" mentioning user 14877 as "Alice"
    Then the bot replies "Added 1 players to rollcall."
    When the user sends "/schedule 10 minutes"
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot posts no message starting with "Rollcall in"
