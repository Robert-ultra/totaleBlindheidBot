Feature: steam_user_id command
  Users register the SteamID64(s) the bot should track.

  Scenario: an invalid Steam ID is rejected
    Given a chat with id 1700
    And a user with id 5801 and first name "Tester"
    When the user sends "/steam_user_id 123"
    Then the bot reply contains "Please specify your Steam user ID(s) as SteamID64"

  Scenario: a valid SteamID64 is stored
    Given a chat with id 1700
    And a user with id 5802 and first name "Tester"
    When the user sends "/steam_user_id 76561198000000000"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000000000"

  Scenario: an admin sets a Steam ID for another user by @username
    Given a chat with id 1701
    When user 5811 sends "/hi"
    Then the bot replies "Hello to you too, User5811!"
    When user 9999 sends "/steam_user_id @user5811 76561198000000011"
    Then the bot replies "Steam user ID(s) for @user5811 has been set to 76561198000000011"

  Scenario: an admin sets Steam IDs for another user by tapped mention
    Given a chat with id 1702
    And a user with id 9999 and first name "Admin"
    When the user sends "/steam_user_id Bob 76561198000000012, 76561198000000013" mentioning user 5812 as "Bob"
    Then the bot replies "Steam user ID(s) for Bob has been set to 76561198000000012, 76561198000000013"

  Scenario: an admin naming an unknown @username is told so
    Given a chat with id 1703
    When user 9999 sends "/steam_user_id @nobody_here 76561198000000014"
    Then the bot replies "I don't know @nobody_here."

  Scenario: an admin sets a Steam ID for another user by bare username
    Given a chat with id 1707
    When user 5821 sends "/hi"
    Then the bot replies "Hello to you too, User5821!"
    When user 9999 sends "/steam_user_id user5821 76561198000000021"
    Then the bot replies "Steam user ID(s) for User5821 has been set to 76561198000000021"
    When user 9999 sends "/steam_user_id nobody_here 76561198000000022"
    Then the bot replies "I don't know nobody_here."
    When user 5822 sends "/steam_user_id user5821 76561198000000023"
    Then the bot replies "Only the admin can set Steam IDs for other users."

  Scenario: linking a Steam account that is not the bot's friend sends it a friend request
    Given a chat with id 1708
    And a user with id 5831 and first name "Tester"
    And Steam account "76561198000000031" is not a friend of the bot
    When the user sends "/steam_user_id 76561198000000031, 76561198000000032"
    Then the bot replies
      """
      Your Steam user ID(s) has been set to 76561198000000031, 76561198000000032

      I've sent a Steam friend request to 76561198000000031. I can see their games once it is accepted.
      """
    And the bot sends Steam account "76561198000000031" a friend request
    And the bot sends Steam account "76561198000000032" no friend request

  Scenario: the admin linking someone's Steam accounts sends them friend requests, unless one is out already
    Given a chat with id 1709
    And Steam account "76561198000000033" is not a friend of the bot
    And the bot has a friend request out to Steam account "76561198000000034"
    When user 5833 sends "/hi"
    Then the bot replies "Hello to you too, User5833!"
    When user 9999 sends "/steam_user_id @user5833 76561198000000033, 76561198000000034"
    Then the bot replies
      """
      Steam user ID(s) for @user5833 has been set to 76561198000000033, 76561198000000034

      I've sent a Steam friend request to 76561198000000033, 76561198000000034. I can see their games once it is accepted.
      """
    And the bot sends Steam account "76561198000000033" a friend request
    And the bot sends Steam account "76561198000000034" no friend request

  Scenario: linking a Steam account that had asked to be the bot's friend accepts its request
    Given a chat with id 1710
    And a user with id 5835 and first name "Tester"
    And Steam account "76561198000000035" has asked to be the bot's friend
    When the user sends "/steam_user_id 76561198000000035"
    Then the bot replies
      """
      Your Steam user ID(s) has been set to 76561198000000035

      I've accepted the Steam friend request from 76561198000000035.
      """
    And the bot accepts the friend request of Steam account "76561198000000035"

  Scenario: when Steam refuses the friend request, the reply says how to add the bot
    Given a chat with id 1711
    And a user with id 5836 and first name "Tester"
    And Steam refuses friend requests to account "76561198000000036"
    When the user sends "/steam_user_id 76561198000000036"
    Then the bot replies
      """
      Your Steam user ID(s) has been set to 76561198000000036

      I couldn't send a Steam friend request to 76561198000000036. Add me on Steam instead: https://steamcommunity.com/profiles/76561190000000000
      """

  Scenario: a non-admin cannot set Steam IDs for someone else
    Given a chat with id 1704
    When user 5814 sends "/steam_user_id @user5811 76561198000000015"
    Then the bot replies "Only the admin can set Steam IDs for other users."

  Scenario: an admin can no longer target a numeric Telegram user ID
    Given a chat with id 1705
    When user 9999 sends "/steam_user_id 12345 76561198000000001"
    Then the bot reply contains "Please specify your Steam user ID(s) as SteamID64"

  Scenario: an admin picks a user from the chat and replies with their Steam ID
    Given a chat with id 1706
    When user 5816 sends "/hi"
    Then the bot replies "Hello to you too, User5816!"
    Given a user with id 9999 and first name "Admin"
    When the user sends "/steam_user_id"
    Then the bot reply starts with "Whose Steam ID(s) do you want to set?"
    And the bot reply offers a "User5816 (@user5816)" button
    When user 5817 named "Sneaky" taps the button containing "User5816"
    Then the tap is answered with "Only the admin can set Steam IDs for other users."
    When user 9999 named "Admin" taps the button containing "User5816"
    Then the bot replies "Reply to this message with the Steam ID(s) for User5816."
    When the latest bot message is remembered
    And the user replies "not an id" to the remembered message
    Then the bot replies "Invalid Steam ID(s). Each must be a 17-digit number (SteamID64) starting with 7656."
    When the user replies "76561198000000016" to the remembered message
    Then the bot replies "Steam user ID(s) for User5816 has been set to 76561198000000016"
