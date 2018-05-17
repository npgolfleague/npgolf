class Page < ApplicationRecord
	extend FriendlyId
	friendly_id :title, :use => [:slugged, :finders]
	validates_presence_of :title, :slug, :content
end
