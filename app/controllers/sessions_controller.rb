class SessionsController < ApplicationController
def create
  player = Player.find_by_email(params[:email])
  if player && player.authenticate(params[:password])
    session[:player_id] = player.id
    redirect_to root_url, notice: "Logged in!"
  else
    flash.now.alert = "Email or password is invalid."
  end
end
def destroy
	session[:player_id] = nil
	redirect_to root_url, notice: "Logged out!"
end
end
