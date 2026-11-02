Feature: GitHub commit notifications
  When new commits are pushed, the bot announces them to chats that opted in via
  /github_notify, and leaves other chats alone.

  Scenario: a new commit is announced to an opted-in chat
    Given a chat with id 7001
    And a user with id 5970 and first name "Tester"
    When the user sends "/github_notify on"
    Then the bot replies "GitHub notifications for this chat have been turned on."
    When a commit "c0ffee1" with message "Add acceptance tests" is pushed to GitHub
    Then chat 7001 receives a GitHub notification containing "New commit"
    And chat 7001 receives a GitHub notification containing "Add acceptance tests"

  Scenario: chats that did not opt in receive nothing
    Given a chat with id 7002
    And a user with id 5971 and first name "Tester"
    When a commit "deadbee" with message "Silent change" is pushed to GitHub
    Then no GitHub notification is posted to chat 7002

  Scenario: an opted-in chat's linked Discord channels are told too
    Given a chat with id 7903
    And a user with id 5972 and first name "Admin"
    And a Discord server "7903" named "Server" with channel "79031" named "dev"
    And Discord channel "79031" is linked to the chat
    When the user sends "/github_notify on"
    Then the bot replies "GitHub notifications for this chat have been turned on."
    When a commit "c0ffee3" with message "Relay commits" is pushed to GitHub
    Then chat 7903 receives a GitHub notification containing "Relay commits"
    And Discord channel "79031" receives a bot message
      """
      New commit: <https://example.test/commit/c0ffee3>
      > Relay commits
      """

  Scenario: a linked channel of a chat that did not opt in receives nothing
    Given a chat with id 7904
    And a user with id 5973 and first name "Admin"
    And a Discord server "7904" named "Server" with channel "79041" named "dev"
    And Discord channel "79041" is linked to the chat
    When a commit "deadbe4" with message "Quiet change" is pushed to GitHub
    Then no GitHub notification is posted to chat 7904
    And Discord channel "79041" receives nothing
