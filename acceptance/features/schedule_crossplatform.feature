Feature: scheduling rollcalls across Telegram and Discord
  A schedule made on either platform is confirmed in the Telegram group and every linked channel,
  with the RSVP buttons on every copy. Cancelling retires every copy, and when the time comes the
  rollcall takes over from the confirmations everywhere.

  Background:
    Given a chat with id 10101
    And a user with id 11101 and first name "Captain"
    And a Discord server "10101" named "Server One" with channel "101011" named "general"
    And a Discord server "10102" named "Server Two" with channel "101021" named "cs"
    And Discord channel "101011" is linked to the chat
    And Discord channel "101021" is linked to the chat

  Scenario: Discord shows the scheduled time in each reader's own timezone
    When the user sends "/schedule 3 hours"
    Then the bot reply shows "in 3 hours" as a "r" date-time 3 hours ahead
    And Discord channel "101011" receives a bot message timing the rollcall 3 hours ahead in Discord timestamps
    When the user sends "/cancel"
    Then the bot replies "Scheduled rollcall cancelled."

  Scenario: a Telegram schedule is confirmed in every linked channel
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot reply offers a "I'm in" button
    And Discord channel "101011" receives a bot message containing "Rollcall scheduled for" with buttons "I'm in, Maybe, No"
    And Discord channel "101021" receives a bot message containing "Rollcall scheduled for" with buttons "I'm in, Maybe, No"
    When the user sends "/cancel"
    Then the bot replies "Scheduled rollcall cancelled."

  Scenario: a Discord schedule is confirmed on Telegram and the other channel
    When Discord user "alice" named "Alice" with id "101010000000000002" runs "/schedule" with time "3 hours" in channel "101011"
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot reply contains "🙋‍♂️ alice"
    And Discord channel "101011" receives a bot message containing "🙋‍♂️ alice" with buttons "I'm in, Maybe, No"
    And Discord channel "101021" receives a bot message containing "🙋‍♂️ alice" with buttons "I'm in, Maybe, No"
    When Discord user "alice" named "Alice" with id "101010000000000002" runs "/cancel" in channel "101021"
    Then the bot replies "Scheduled rollcall cancelled."
    And Discord channel "101021" receives a bot message starting with "Scheduled rollcall cancelled."
    And Discord channel "101011" receives a bot message starting with "Scheduled rollcall cancelled."

  Scenario: a Discord schedule without a time is answered everywhere
    When Discord user "alice" named "Alice" with id "101010000000000002" runs "/schedule" in channel "101011"
    Then Discord channel "101011" receives a bot message starting with "Please specify a time to schedule the rollcall."
    And the bot replies "Please specify a time to schedule the rollcall."
    And Discord channel "101021" receives a bot message starting with "Please specify a time to schedule the rollcall."

  Scenario: cancelling from Discord retires every copy
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When the latest bot message is remembered
    And the latest bot message in Discord channel "101011" is remembered
    And Discord user "alice" named "Alice" with id "101010000000000002" runs "/cancel" in channel "101021"
    Then the bot replies "Scheduled rollcall cancelled."
    And the remembered Discord message is edited to contain "Rollcall scheduled for" without buttons
    When Discord user "bob" named "Bob" with id "101010000000000003" taps "rsvp:yes" on the remembered Discord message
    Then the Discord tap is answered with "This RSVP has expired."

  Scenario: cancelling with nothing scheduled is answered everywhere
    When Discord user "alice" named "Alice" with id "101010000000000002" runs "/cancel" in channel "101011"
    Then Discord channel "101011" receives a bot message starting with "No rollcall scheduled for this group."
    And the bot replies "No rollcall scheduled for this group."

  Scenario: when the time comes the rollcall takes over on every platform
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When the latest bot message in Discord channel "101011" is remembered
    And Discord user "bob" named "Bob" with id "101010000000000003" taps "rsvp:yes" on the remembered Discord message
    Then the remembered Discord message is edited to contain "🙋‍♂️ Captain bob"
    When the scheduled rollcall's time has come
    Then the bot reply offers a "Joining" button
    And the bot reply contains "🙋‍♂️ Captain bob"
    And Discord channel "101011" receives a bot message containing "🙋‍♂️ Captain bob" with buttons "Joining, Maybe/Later, No"
    And Discord channel "101021" receives a bot message containing "🙋‍♂️ Captain bob" with buttons "Joining, Maybe/Later, No"
    And the remembered Discord message is edited to contain "Rollcall scheduled for" without buttons

  Scenario: everyone who said yes or maybe is tagged when the rollcall fires, rotation or not
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When user 11104 named "Mia" taps maybe
    And the latest bot message in Discord channel "101011" is remembered
    And Discord user "kit_cs" named "Kit" with id "101010000000000010" taps "rsvp:yes" on the remembered Discord message
    And Discord user "noah_cs" named "Noah" with id "101010000000000011" taps "rsvp:no" on the remembered Discord message
    Then the remembered Discord message is edited to contain "🤷‍♂️ Mia"
    And the remembered Discord message is edited to contain "🙋‍♂️ Captain kit\_cs"
    And the remembered Discord message is edited to contain "🙅‍♂️ noah\_cs"
    When the scheduled rollcall's time has come
    Then the bot reply offers a "Joining" button
    And the bot reply links "Mia" to "tg://user?id=11104"
    And Discord channel "101011" receives a bot message containing "<@101010000000000010>" with buttons "Joining, Maybe/Later, No"
    And Discord channel "101011" receives no bot message containing "<@101010000000000011>"

  Scenario: a scheduler linked after scheduling is named by Telegram when the rollcall fires
    Given the user is an admin of the chat
    When user 11102 sends "/hi"
    Then the bot replies "Hello to you too, User11102!"
    When Discord user "gwen_cs" named "Gwen" with id "101010000000000007" runs "/schedule" with time "3 hours" in channel "101011"
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot reply contains "🙋‍♂️ gwen_cs"
    When the latest bot message is remembered
    And the user sends "/link_user @user11102 discord:gwen_cs"
    Then the bot replies "Linked User11102 to Discord user gwen_cs."
    When the scheduled rollcall's time has come
    Then the bot reply offers a "Joining" button
    And the bot reply contains "🙋‍♂️ User11102"
    And the bot reply does not contain "gwen_cs"
    And Discord channel "101011" receives a bot message containing "🙋‍♂️ User11102" with buttons "Joining, Maybe/Later, No"

  Scenario: cancelling on Telegram retires every Discord copy
    When the user sends "/schedule 3 hours"
    Then the bot reply starts with "Rollcall scheduled for"
    When the latest bot message in Discord channel "101021" is remembered
    And the user sends "/cancel"
    Then the bot replies "Scheduled rollcall cancelled."
    And the remembered Discord message is edited to contain "Rollcall scheduled for" without buttons
    And Discord channel "101011" receives a bot message
      """
      Scheduled rollcall cancelled.
      """
    And Discord channel "101021" receives a bot message
      """
      Scheduled rollcall cancelled.
      """

  Scenario: a Discord user sets their timezone on Discord and schedules in it
    When Discord user "hana_cs" named "Hana" with id "101010000000000008" runs "/timezone" in channel "101011"
    Then Discord channel "101011" receives a bot message
      """
      Your current timezone is UTC
      """
    When Discord user "hana_cs" named "Hana" with id "101010000000000008" runs "/timezone" with timezone "UTC+2" in channel "101011"
    Then Discord channel "101011" receives a bot message
      """
      Your timezone has been set to +02:00
      """
    And the bot replies "Your timezone has been set to +02:00"
    When Discord user "hana_cs" named "Hana" with id "101010000000000008" runs "/schedule" with time "3 hours" in channel "101011"
    Then the bot reply starts with "Rollcall scheduled for"
    And the bot reply contains "GMT+2"
    And Discord channel "101021" receives a bot message containing "Rollcall scheduled for <t:" with buttons "I'm in, Maybe, No"
    When Discord user "hana_cs" named "Hana" with id "101010000000000008" runs "/cancel" in channel "101011"
    Then the bot replies "Scheduled rollcall cancelled."

  Scenario: a timezone set on Discord carries over when the person is linked
    Given the user is an admin of the chat
    When Discord user "ivo_cs" named "Ivo" with id "101010000000000009" runs "/timezone" with timezone "Dublin" in channel "101011"
    Then Discord channel "101011" receives a bot message
      """
      Your timezone has been set to Europe/Dublin
      """
    When user 11103 sends "/hi"
    Then the bot replies "Hello to you too, User11103!"
    When the user sends "/link_user @user11103 discord:ivo_cs"
    Then the bot replies "Linked User11103 to Discord user ivo_cs."
    When user 11103 sends "/timezone"
    Then the bot replies "Your current timezone is Europe/Dublin"
