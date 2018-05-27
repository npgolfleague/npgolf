Rails.application.routes.draw do
  
  get  'static_pages/home'
  get  'static_pages/help'
  resources :pages
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  root 'static_pages#home'
  match '/:id' => 'pages#show', :via => [:get], :as => 'page_show'
  
end
