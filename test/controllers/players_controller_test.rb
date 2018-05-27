require 'test_helper'

class PlayersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @player = players(:one)
  end

  test "should get index" do
    get players_url
    assert_response :success
  end

  test "should get new" do
    get new_player_url
    assert_response :success
  end

  test "should create player" do
    assert_difference('Player.count') do
      post players_url, params: { player: { active: @player.active, averageround: @player.averageround, cangetemail: @player.cangetemail, duespaid: @player.duespaid, email: @player.email, firstname: @player.firstname, gender: @player.gender, goal20: @player.goal20, goal2: @player.goal2, goal7: @player.goal7, hashdcp: @player.hashdcp, hdcp20: @player.hdcp20, hdcp2: @player.hdcp2, hdcp7: @player.hdcp7, highround: @player.highround, lastname: @player.lastname, lifetimeprizemoney: @player.lifetimeprizemoney, lowround: @player.lowround, nickname: @player.nickname, no_hash: @player.no_hash, numnoshows: @player.numnoshows, password_digest: @player.password_digest, phone: @player.phone, reminder: @player.reminder, role: @player.role, seasonprizemoney: @player.seasonprizemoney, yes_hash: @player.yes_hash } }
    end

    assert_redirected_to player_url(Player.last)
  end

  test "should show player" do
    get player_url(@player)
    assert_response :success
  end

  test "should get edit" do
    get edit_player_url(@player)
    assert_response :success
  end

  test "should update player" do
    patch player_url(@player), params: { player: { active: @player.active, averageround: @player.averageround, cangetemail: @player.cangetemail, duespaid: @player.duespaid, email: @player.email, firstname: @player.firstname, gender: @player.gender, goal20: @player.goal20, goal2: @player.goal2, goal7: @player.goal7, hashdcp: @player.hashdcp, hdcp20: @player.hdcp20, hdcp2: @player.hdcp2, hdcp7: @player.hdcp7, highround: @player.highround, lastname: @player.lastname, lifetimeprizemoney: @player.lifetimeprizemoney, lowround: @player.lowround, nickname: @player.nickname, no_hash: @player.no_hash, numnoshows: @player.numnoshows, password_digest: @player.password_digest, phone: @player.phone, reminder: @player.reminder, role: @player.role, seasonprizemoney: @player.seasonprizemoney, yes_hash: @player.yes_hash } }
    assert_redirected_to player_url(@player)
  end

  test "should destroy player" do
    assert_difference('Player.count', -1) do
      delete player_url(@player)
    end

    assert_redirected_to players_url
  end
end
