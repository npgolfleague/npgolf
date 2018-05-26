class CreatePlayers < ActiveRecord::Migration[5.0]
  def change
    create_table :players do |t|
      t.string :firstname
      t.string :lastname
      t.string :nickname
      t.string :email
      t.string :phone
      t.string :gender
      t.string :yes_hash
      t.string :no_hash
      t.string :password_digest
      t.integer :highround
      t.decimal :averageround
      t.integer :lowround
      t.integer :numnoshows
      t.integer :goal2
      t.integer :goal7
      t.integer :goal20
      t.decimal :hdcp2
      t.decimal :hdcp7
      t.decimal :hdcp20
      t.decimal :seasonprizemoney
      t.decimal :lifetimeprizemoney
      t.boolean :duespaid
      t.boolean :reminder
      t.boolean :active
      t.boolean :hashdcp
      t.boolean :cangetemail

      t.timestamps
    end
  end
end
