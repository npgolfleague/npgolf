class PlayersController < ApplicationController
	def new
		@player = Player.new
	end

	def create
		@player= Player.new(player_params)
		if @player.save
			
		else
			render "new"
		end
	end


	private

	def player_params
		params.require(:email).permit(:password, :password_confirmation, :firstname, :lastname, :nickname, :phone, :gender)
	end
end
	