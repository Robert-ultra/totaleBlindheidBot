Feature: linking Telegram and Discord users
  A group admin records that a Telegram user and a Discord user are the same person. Discord people
  are named as discord:<username> in commands; a Discord user who spoke before being linked keeps
  what was recorded about them, and the Telegram name takes over once they are linked.

  Scenario: only an admin can link users
    Given a chat with id 9001
    And a user with id 9101 and first name "Member"
    When the user sends "/link_user @someone discord:someone"
    Then the bot replies "Only a group admin can link or unlink users."

  Scenario: linking needs a Telegram user and a Discord username
    Given a chat with id 9002
    And a user with id 9102 and first name "Admin"
    And the user is an admin of the chat
    When the user sends "/link_user @alice"
    Then the bot replies "Usage: /link_user @telegram_user discord:<Discord username>"
    When the user sends "/link_user @alice bob"
    Then the bot replies "Usage: /link_user @telegram_user discord:<Discord username>"

  Scenario: the Telegram user must be known
    Given a chat with id 9003
    And a user with id 9103 and first name "Admin"
    And the user is an admin of the chat
    When the user sends "/link_user @stranger discord:bob"
    Then the bot reply starts with "I don't know @stranger."

  Scenario: the Discord user must be on a linked server
    Given a chat with id 9004
    And a user with id 9104 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9004" named "Server" with channel "90041" named "general"
    And Discord channel "90041" is linked to the chat
    When user 9114 sends "/hi"
    Then the bot reply starts with "Hello to you too"
    When the user sends "/link_user @user9114 discord:nobody"
    Then the bot reply starts with "I can't find Discord user"
    And the bot reply contains "nobody"

  Scenario: a Telegram user is linked to a Discord member who never spoke
    Given a chat with id 9005
    And a user with id 9105 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9005" named "Server" with channel "90051" named "general" and member "bob" named "Bob" with id "900500000000000001"
    And Discord channel "90051" is linked to the chat
    When user 9115 sends "/hi"
    Then the bot reply starts with "Hello to you too"
    When the user sends "/link_user @user9115 discord:bob"
    Then the bot replies "Linked User9115 to Discord user bob."
    When the user sends "/link_user @user9115 discord:bob"
    Then the bot replies "User9115 is already linked to Discord user bob."
    When the user sends "/unlink_user @user9115"
    Then the bot replies "Unlinked User9115 from Discord user bob."
    When the user sends "/unlink_user @user9115"
    Then the bot replies "User9115 is not linked to a Discord user."

  Scenario: a Discord user who spoke keeps their rotation spot and takes the Telegram name
    Given a chat with id 9006
    And a user with id 9106 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9006" named "Server" with channel "90061" named "general"
    And Discord channel "90061" is linked to the chat
    When Discord user "carol_cs" named "Carol" with id "900600000000000001" says "hello" in channel "90061"
    Then the bot replies "Carol: hello"
    When user 9116 sends "/hi"
    Then the bot reply starts with "Hello to you too"
    When the user sends "/link_user @user9116 discord:carol_cs"
    Then the bot replies "Linked User9116 to Discord user carol_cs."

  Scenario: a Discord account cannot be linked to two Telegram users
    Given a chat with id 9007
    And a user with id 9107 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9007" named "Server" with channel "90071" named "general" and member "dave" named "Dave" with id "900700000000000001"
    And Discord channel "90071" is linked to the chat
    When user 9117 sends "/hi"
    Then the bot reply starts with "Hello to you too"
    When user 9118 sends "/hi"
    Then the bot reply starts with "Hello to you too"
    When the user sends "/link_user @user9117 discord:dave"
    Then the bot replies "Linked User9117 to Discord user dave."
    When the user sends "/link_user @user9118 discord:dave"
    Then the bot replies "Discord user dave is already linked to User9117. Unlink them first with /unlink_user."
    When the user sends "/link_user @user9117 discord:eve"
    Then the bot replies "User9117 is already linked to Discord user dave. Unlink them first with /unlink_user."

  Scenario: a Discord-only player gets Steam ids and is named in the rotation
    Given a chat with id 9008
    And a user with id 9999 and first name "Admin"
    And a Discord server "9008" named "Server" with channel "90081" named "general" and member "erin" named "Erin" with id "900800000000000001"
    And the user is an admin of the chat
    And Discord channel "90081" is linked to the chat
    When the user sends "/steam_user_id discord:erin 76561198000009008"
    Then the bot replies "Steam user ID(s) for Erin has been set to 76561198000009008"

  Scenario: a Discord-only player's Steam ids and game history follow them when linked
    Given a chat with id 9009
    And a user with id 9999 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9009" named "Server" with channel "90091" named "general" and member "fay" named "Fay" with id "900900000000000001"
    And Discord channel "90091" is linked to the chat
    When Discord user "fay" named "Fay" with id "900900000000000001" says "gg" in channel "90091"
    Then the bot replies "Fay: gg"
    When the user sends "/steam_user_id discord:fay 76561198000009009"
    Then the bot replies "Steam user ID(s) for Fay has been set to 76561198000009009"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009009" playing CS2 with score "5-3" on map "Inferno"
    And Steam reports user "76561198000009009" stopped playing
    Then chat 9009 eventually receives a new Steam message "🏆 Gamer won a game on Inferno (Competitive): 5️⃣-3️⃣"
    When user 9119 sends "/hi"
    Then the bot replies "Hello to you too, User9119!"
    When the user sends "/link_user @user9119 discord:fay"
    Then the bot replies "Linked User9119 to Discord user fay."
    When user 9119 sends "/game_history"
    Then the bot replies "🏆 Inferno · Competitive · 5-3"
    When Steam mappings are refreshed
    And Steam reports user "76561198000009009" playing CS2 with score "8-3" on map "Inferno"
    And Steam reports user "76561198000009009" stopped playing
    Then chat 9009 eventually receives a new Steam message "🏆 Gamer won a game on Inferno (Competitive): 8️⃣-3️⃣"
    When user 9119 sends "/game_history"
    Then the bot replies:
      """
      🏆 Inferno · Competitive · 5-3
      🏆 Inferno · Competitive · 8-3
      """
    When the user sends "/unlink_user @user9119"
    Then the bot replies "Unlinked User9119 from Discord user fay."
    When user 9119 sends "/game_history"
    Then the bot replies:
      """
      🏆 Inferno · Competitive · 5-3
      🏆 Inferno · Competitive · 8-3
      """

  Scenario: a Steam id both accounts registered is kept once
    Given a chat with id 9010
    And a user with id 9999 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9010" named "Server" with channel "90101" named "general" and member "gus" named "Gus" with id "901000000000000001"
    And Discord channel "90101" is linked to the chat
    When user 9120 sends "/steam_user_id 76561198000009010"
    Then the bot replies "Your Steam user ID(s) has been set to 76561198000009010"
    When the user sends "/steam_user_id discord:gus 76561198000009010"
    Then the bot replies "Steam user ID(s) for Gus has been set to 76561198000009010"
    When the user sends "/link_user @user9120 discord:gus"
    Then the bot replies "Linked User9120 to Discord user gus."
    When Steam mappings are refreshed
    And Steam reports user "76561198000009010" playing CS2 with score "9-3" on map "Vertigo"
    And Steam reports user "76561198000009010" stopped playing
    Then chat 9010 eventually receives a new Steam message "🏆 Gamer won a game on Vertigo (Competitive): 9️⃣-3️⃣"
    When user 9120 sends "/game_history"
    Then the bot replies "🏆 Vertigo · Competitive · 9-3"

  Scenario: the chat roster lists a linked person once, under their Telegram name
    Given a chat with id 9011
    And a user with id 9999 and first name "Admin"
    And the user is an admin of the chat
    And a Discord server "9011" named "Server" with channel "90111" named "general"
    And Discord channel "90111" is linked to the chat
    When Discord user "hal_cs" named "Hal" with id "901100000000000001" says "hey" in channel "90111"
    Then the bot replies "Hal: hey"
    When user 9121 sends "/hi"
    Then the bot replies "Hello to you too, User9121!"
    When the user sends "/steam_user_id"
    Then the bot reply starts with "Whose Steam ID(s) do you want to set?"
    And the bot reply offers the buttons "Admin (@admin)", "Hal", "User9121 (@user9121)"
    When the user sends "/link_user @user9121 discord:hal_cs"
    Then the bot replies "Linked User9121 to Discord user hal_cs."
    When the user sends "/steam_user_id"
    Then the bot reply starts with "Whose Steam ID(s) do you want to set?"
    And the bot reply offers the buttons "Admin (@admin)", "User9121 (@user9121)"
