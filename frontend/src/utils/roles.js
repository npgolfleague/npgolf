export const isSuperAdmin = (user) => {
  const role = user?.role
  return role === 'super_admin' || role === 'admin'
}

export const isAdminCapable = (user) => {
  const role = user?.role
  return role === 'super_admin' || role === 'admin' || role === 'league_admin'
}
