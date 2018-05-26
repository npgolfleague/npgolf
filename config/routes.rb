Rails.application.routes.draw do
  resources :players
  resources :pages
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html

  match '/:id' => 'pages#show', :via => [:get], :as => 'page_show'

end
