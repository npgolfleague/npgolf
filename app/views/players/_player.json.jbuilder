json.extract! player, :id, :firstname, :lastname, :nickname, :email, :role, :phone, :gender, :yes_hash, :no_hash, :password_digest, :highround, :averageround, :lowround, :numnoshows, :goal2, :goal7, :goal20, :hdcp2, :hdcp7, :hdcp20, :seasonprizemoney, :lifetimeprizemoney, :duespaid, :reminder, :active, :hashdcp, :cangetemail, :created_at, :updated_at
json.url player_url(player, format: :json)
