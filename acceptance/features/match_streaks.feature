Feature: Win and loss streaks in end-of-game messages
  A finished competitive or premier match mentions each named player's current run of wins or
  losses once it reaches three. Other modes neither show nor break a run.

  Scenario: a third win in a row is mentioned
    Given a chat with id 2401
    And a user with id 6401 and first name "Kit"
    When the user sends "/steam_user_id 76561198000002401"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000002401"
    Given chat 2401 already has these finished matches
      | player | name | mode        | map     | score | minutes_ago |
      | 6401   | Kit  | Competitive | Mirage  | 13-5  | 120         |
      | 6401   | Kit  | Premier     | Ancient | 13-9  | 60          |
    When Steam mappings are refreshed
    And Steam reports user "76561198000002401" playing CS2 as "Kit" with score "13-7" on map "Inferno"
    And Steam reports user "76561198000002401" stopped playing
    Then chat 2401 eventually receives a new Steam message reading
      """
      🏆 Kit won a game on Inferno (Competitive): 1️⃣3️⃣-7️⃣
      🔥 Kit: 3 wins in a row
      """

  Scenario: a loss streak skips other modes and stops at a tie
    Given a chat with id 2402
    And a user with id 6402 and first name "Kit"
    When the user sends "/steam_user_id 76561198000002402"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000002402"
    Given chat 2402 already has these finished matches
      | player | name | mode        | map     | score | minutes_ago |
      | 6402   | Kit  | Competitive | Nuke    | 12-12 | 300         |
      | 6402   | Kit  | Competitive | Mirage  | 5-13  | 240         |
      | 6402   | Kit  | Competitive | Ancient | 9-13  | 180         |
      | 6402   | Kit  | Casual      | Dust II | 8-0   | 120         |
      | 6402   | Kit  | Premier     | Anubis  | 10-13 | 60          |
    When Steam mappings are refreshed
    And Steam reports user "76561198000002402" playing CS2 as "Kit" with score "7-13" on map "Inferno"
    And Steam reports user "76561198000002402" stopped playing
    Then chat 2402 eventually receives a new Steam message reading
      """
      ☠️ Kit lost a game on Inferno (Competitive): 7️⃣-1️⃣3️⃣
      💀 Kit: 4 losses in a row
      """

  Scenario: a second win in a row is not mentioned
    Given a chat with id 2403
    And a user with id 6403 and first name "Kit"
    When the user sends "/steam_user_id 76561198000002403"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000002403"
    Given chat 2403 already has these finished matches
      | player | name | mode        | map    | score | minutes_ago |
      | 6403   | Kit  | Competitive | Mirage | 5-13  | 120         |
      | 6403   | Kit  | Competitive | Nuke   | 13-5  | 60          |
    When Steam mappings are refreshed
    And Steam reports user "76561198000002403" playing CS2 as "Kit" with score "13-7" on map "Inferno"
    And Steam reports user "76561198000002403" stopped playing
    Then chat 2403 eventually receives a new Steam message reading
      """
      🏆 Kit won a game on Inferno (Competitive): 1️⃣3️⃣-7️⃣
      """

  Scenario: a grouped announcement keeps every player's streak when it is edited
    Given a chat with id 2404
    When user 6404 sends "/steam_user_id 76561198000002404"
    Then the bot reply contains "76561198000002404"
    When user 6405 sends "/steam_user_id 76561198000002405"
    Then the bot reply contains "76561198000002405"
    Given chat 2404 already has these finished matches
      | player | name  | mode        | map     | score | minutes_ago |
      | 6404   | Alpha | Competitive | Mirage  | 13-5  | 180         |
      | 6404   | Alpha | Competitive | Nuke    | 13-9  | 120         |
      | 6405   | Bravo | Competitive | Ancient | 13-2  | 180         |
      | 6405   | Bravo | Competitive | Anubis  | 13-11 | 120         |
    When Steam mappings are refreshed
    And Steam reports user "76561198000002404" playing CS2 as "Alpha" with score "13-7" on map "Vertigo"
    And Steam reports user "76561198000002405" playing CS2 as "Bravo" with score "13-7" on map "Vertigo"
    And Steam reports user "76561198000002404" stopped playing
    And the matches of Steam user "76561198000002404" have been recorded
    And Steam reports user "76561198000002405" stopped playing
    Then chat 2404 eventually receives a new Steam message reading
      """
      🏆 Alpha won a game on Vertigo (Competitive): 1️⃣3️⃣-7️⃣
      🔥 Alpha: 3 wins in a row
      """
    And the Steam message in chat 2404 is edited to read
      """
      🏆 Bravo and Alpha won a game on Vertigo (Competitive): 1️⃣3️⃣-7️⃣
      🔥 Bravo: 3 wins in a row
      🔥 Alpha: 3 wins in a row
      """
