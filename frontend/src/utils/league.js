// Detect league alias from URL path
export function detectLeaguePrefix() {
  const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
  const commonRoutes = ['api', 'login', 'register', 'forgot-password', 'reset-password', 
                        'sms-consent', 'dashboard', 'about', 'app', 'assets', 'billing-entities'];
  
  // If first segment is not a common route, it's likely a league alias
  if (pathParts.length > 0 && !commonRoutes.includes(pathParts[0])) {
    return '/' + pathParts[0];
  }
  return '';
}

// Prepend league prefix to a path
export function withLeaguePrefix(path) {
  const prefix = detectLeaguePrefix();
  // Avoid double slashes
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return prefix + path;
}
