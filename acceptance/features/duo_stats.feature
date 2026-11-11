Feature: duo stats
  /stats <player> with <player> compares how the first player does in competitive games together
  with the second against how they do overall.

  Background:
    Given every scenario records these shared matches
      | player | name  | map     | score | with |
      | 6501   | Alice | Nuke    | 13-7  | 6502 |
      | 6501   | Alice | Nuke    | 13-9  | 6502 |
      | 6501   | Alice | Inferno | 13-5  | 6502 |
      | 6501   | Alice | Inferno | 5-13  | 6502 |
      | 6501   | Alice | Ancient | 7-13  | 6502 |
      | 6501   | Alice | Ancient | 7-13  |      |
      | 6501   | Alice | Ancient | 2-13  |      |
      | 6502   | Bob   | Nuke    | 13-7  | 6501 |
      | 6502   | Bob   | Nuke    | 13-9  | 6501 |
      | 6502   | Bob   | Inferno | 13-5  | 6501 |
      | 6502   | Bob   | Inferno | 5-13  | 6501 |
      | 6502   | Bob   | Ancient | 7-13  | 6501 |
      | 6503   | Carl  | Nuke    | 13-0  |      |

  Scenario: a player's games with another are compared to their overall record
    Given a chat with id 2501
    And the chat has recorded the shared matches
    When user 6503 sends "/stats Alice with Bob"
    Then the bot replies
      """
      🤝 Alice with Bob
      Together: ██████░░░░ 60% (5 games)
      Overall: ████░░░░░░ 43% (7 games)
      """

  Scenario: leaving out the first player compares the sender with the other
    Given a chat with id 2502
    And the chat has recorded the shared matches
    When user 6501 sends "/stats with bob"
    Then the bot reply starts with "🤝 Alice with Bob"
    And the bot reply contains "Together: ██████░░░░ 60% (5 games)"

  Scenario: players who never played together are told so
    Given a chat with id 2503
    And the chat has recorded the shared matches
    When user 6501 sends "/stats Bob with Carl"
    Then the bot replies "Bob hasn't played a competitive game with Carl yet."

  Scenario: an unknown partner is reported as such
    Given a chat with id 2504
    And the chat has recorded the shared matches
    When user 6501 sends "/stats Alice with Nobody"
    Then the bot replies
      """
      I don't have any recorded games for "Nobody" in this chat.
      """

  Scenario: duo stats on Discord
    Given a chat with id 2506
    And the chat has recorded the shared matches
    And a Discord server "2506" named "Duos" with channel "25061" named "general"
    And Discord channel "25061" is linked to the chat
    When Discord user "kit_cs" named "Kit" with id "250600000000000001" runs "/stats" with player "Alice with Bob" in channel "25061"
    Then Discord channel "25061" receives a bot message
      """
      **🤝 Alice with Bob**
      Together: ██████░░░░ 60% (5 games)
      Overall: ████░░░░░░ 43% (7 games)
      """
