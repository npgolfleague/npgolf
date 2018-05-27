# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20180527035715) do

  create_table "friendly_id_slugs", force: :cascade do |t|
    t.string   "slug",                      null: false
    t.integer  "sluggable_id",              null: false
    t.string   "sluggable_type", limit: 50
    t.string   "scope"
    t.datetime "created_at"
    t.index ["slug", "sluggable_type", "scope"], name: "index_friendly_id_slugs_on_slug_and_sluggable_type_and_scope", unique: true
    t.index ["slug", "sluggable_type"], name: "index_friendly_id_slugs_on_slug_and_sluggable_type"
    t.index ["sluggable_id"], name: "index_friendly_id_slugs_on_sluggable_id"
    t.index ["sluggable_type"], name: "index_friendly_id_slugs_on_sluggable_type"
  end

  create_table "pages", force: :cascade do |t|
    t.string   "title"
    t.string   "slug"
    t.text     "content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_pages_on_slug", unique: true
  end

  create_table "players", force: :cascade do |t|
    t.string   "firstname"
    t.string   "lastname"
    t.string   "nickname"
    t.string   "email"
    t.string   "role"
    t.string   "phone"
    t.string   "gender"
    t.string   "yes_hash"
    t.string   "no_hash"
    t.string   "password_digest"
    t.integer  "highround"
    t.decimal  "averageround"
    t.integer  "lowround"
    t.integer  "numnoshows"
    t.integer  "goal2"
    t.integer  "goal7"
    t.integer  "goal20"
    t.decimal  "hdcp2"
    t.decimal  "hdcp7"
    t.decimal  "hdcp20"
    t.decimal  "seasonprizemoney"
    t.decimal  "lifetimeprizemoney"
    t.boolean  "duespaid"
    t.boolean  "reminder"
    t.boolean  "active"
    t.boolean  "hashdcp"
    t.boolean  "cangetemail"
    t.datetime "created_at",         null: false
    t.datetime "updated_at",         null: false
  end

end
