Feature: weekly rollcalls
  "/schedule every <weekday> <time>" repeats a rollcall every week in the scheduler's timezone.
  Each occurrence's RSVP confirmation is posted 12 hours ahead, so its list outlives the rollcall.

  Scenario: a weekly rollcall within 12 hours is confirmed right away
    Given a chat with id 12001
    And a user with id 12101 and first name "Captain"
    When the user sends "/schedule every" with the weekday and time 3 hours ahead
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot reply contains ", repeating every "
    And the bot reply contains "🙋‍♂️ Captain"
    And the bot reply offers a "I'm in" button

  Scenario: a weekly rollcall further out than 12 hours is confirmed once it comes close
    Given a chat with id 12002
    And a user with id 12102 and first name "Captain"
    When the user sends "/schedule every" with the weekday and time 50 hours ahead
    Then the bot reply starts with "Rollcall scheduled every "
    And the bot reply contains "I'll post the RSVP 12 hours before each one."
    When the scheduled rollcall is 3 hours away
    Then the bot posts a message starting with "Rollcall scheduled for"
    And the bot reply offers a "I'm in" button

  Scenario: a weekly rollcall stays scheduled after it fires
    Given a chat with id 12003
    And a user with id 12103 and first name "Captain"
    When the user sends "/schedule every" with the weekday and time 3 hours ahead
    Then the bot reply starts with "Rollcall scheduled for"
    When the scheduled rollcall's time has come
    Then the bot posts a message offering a "Joining" button
    And a weekly rollcall is still scheduled for the chat
    And the bot posts a message starting with "Rollcall scheduled for"

  Scenario: /rollcall every schedules a weekly rollcall too
    Given a chat with id 12004
    And a user with id 12104 and first name "Captain"
    When the user sends "/rollcall every" with the weekday and time 3 hours ahead
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot reply contains ", repeating every "

  Scenario: an unknown weekday is rejected
    Given a chat with id 12005
    And a user with id 12105 and first name "Captain"
    When the user sends "/schedule every someday 21:00"
    Then the bot replies "Invalid time format."

  Scenario: cancelling ends the series
    Given a chat with id 12006
    And a user with id 12106 and first name "Captain"
    When the user sends "/schedule every" with the weekday and time 50 hours ahead
    Then the bot reply starts with "Rollcall scheduled every "
    When the user sends "/cancel"
    Then the bot replies "Scheduled rollcall cancelled."
    And no rollcall is scheduled for the chat
