# npgolf Frontend

React + Vite frontend for the npgolf application with user authentication and user management.

## Features

- **Login/Register** — User authentication with JWT
- **Protected Routes** — Only authenticated users can access the users page
- **Users List** — View all registered users
- **Tailwind CSS** — Modern, responsive UI
- **API Integration** — Communicates with Node backend at http://localhost:3000

## Quick Start

### 1. Install Dependencies

```powershell
cd frontend
npm install
```

### 2. Start Dev Server

```powershell
npm run dev
```

Frontend will be at **http://localhost:3001**
Make sure the backend is running on **http://localhost:3000**

### 3. Build for Production

```powershell
npm run build
```

Output: `dist/` folder ready to deploy

## Usage

1. Go to http://localhost:3001
2. Click "Register" to create a new account (password must be 8+ chars, letters + numbers)
3. Login with your credentials
4. View the users list and logout

## Project Structure

```
frontend/
├── src/
│   ├── api.js                 # API client with axios
│   ├── main.jsx              # App entry
│   ├── index.css             # Tailwind CSS
│   ├── context/
│   │   └── AuthContext.jsx   # Authentication context
│   ├── components/
│   │   └── ProtectedRoute.jsx # Route guard
│   └── pages/
│       ├── Login.jsx         # Login page
│       ├── Register.jsx      # Registration page
│       └── Users.jsx         # Users list page
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

## Technology Stack

- **React 18** — UI framework
- **Vite** — Fast build tool
- **React Router v6** — Client-side routing
- **Axios** — HTTP client
- **Tailwind CSS** — Utility-first CSS
- **PostCSS** — CSS processing
