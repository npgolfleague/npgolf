class AddIndexPages < ActiveRecord::Migration[5.0]
  def change
  	add_index :pages, :slug, :unique => true
  end
end
