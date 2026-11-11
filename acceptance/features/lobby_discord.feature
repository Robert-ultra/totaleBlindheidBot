Feature: full lobbies across Telegram and Discord
  A lobby filled by Discord taps is announced on Telegram and in every linked channel, and the
  Discord copies show the waitlist.

  Scenario: a lobby that fills from Discord is announced there too
    Given a chat with id 13002
    And a user with id 13201 and first name "Captain"
    And a Discord server "13001" named "Server One" with channel "130011" named "general"
    And Discord channel "130011" is linked to the chat
    When the user sends "/rollcall"
    Then the bot reply contains "🙋‍♂️ Captain"
    When the latest bot message in Discord channel "130011" is remembered
    And Discord user "bea_cs" named "Bea" with id "130010000000000002" taps "rsvp:yes" on the remembered Discord message
    Then the remembered Discord message is edited to contain "🙋‍♂️ Captain bea\_cs"
    When Discord user "cid_cs" named "Cid" with id "130010000000000003" taps "rsvp:yes" on the remembered Discord message
    Then the remembered Discord message is edited to contain "🙋‍♂️ Captain bea\_cs cid\_cs"
    When Discord user "dee_cs" named "Dee" with id "130010000000000004" taps "rsvp:yes" on the remembered Discord message
    Then the remembered Discord message is edited to contain "🙋‍♂️ Captain bea\_cs cid\_cs dee\_cs"
    When Discord user "eve_cs" named "Eve" with id "130010000000000005" taps "rsvp:yes" on the remembered Discord message
    Then Discord channel "130011" receives a bot message containing "Lobby full!"
    And the bot posts a message starting with "Lobby full!"
    When Discord user "fay_cs" named "Fay" with id "130010000000000006" taps "rsvp:yes" on the remembered Discord message
    Then the remembered Discord message is edited to contain "⏳ Waitlist: fay\_cs"
