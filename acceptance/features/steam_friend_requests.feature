Feature: Steam friend requests
  Steam only shows the bot what its friends are playing, so the bot befriends the accounts it tracks.

  Scenario: rollcall players who are not the bot's friends are sent a request when the bot logs on
    Given a chat with id 9901
    And a user with id 9911 and first name "Captain"
    When user 9921 sends "/steam_user_id 76561198000009921"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009921"
    When user 9922 sends "/steam_user_id 76561198000009922"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009922"
    When user 9923 sends "/steam_user_id 76561198000009923"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009923"
    When user 9924 sends "/steam_user_id 76561198000009924"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009924"
    When the user sends "/rollcall_add_player user9921 user9922"
    Then the bot replies "Added 2 players to rollcall."
    When the user sends "/rollcall_add_player @user9923" typing the username "@user9923"
    Then the bot replies "Added 1 players to rollcall."
    Given Steam account "76561198000009921" is not a friend of the bot
    And the bot has a friend request out to Steam account "76561198000009922"
    And Steam account "76561198000009923" is not a friend of the bot
    And Steam account "76561198000009924" is not a friend of the bot
    When the bot logs on to Steam again
    Then the bot sends Steam account "76561198000009921" a friend request
    And the bot sends Steam account "76561198000009923" a friend request
    And the bot sends Steam account "76561198000009922" no friend request
    And the bot sends Steam account "76561198000009924" no friend request

  Scenario: a friend request from a linked account is accepted when it arrives
    Given a chat with id 9902
    And a user with id 9931 and first name "Tester"
    When the user sends "/steam_user_id 76561198000009931"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009931"
    When Steam mappings are refreshed
    And Steam account "76561198000009931" asks to be the bot's friend
    Then the bot accepts the friend request of Steam account "76561198000009931"

  Scenario: a friend request from an account nobody linked is left alone
    When Steam account "76561198000009941" asks to be the bot's friend
    Then the bot sends Steam account "76561198000009941" no friend request
