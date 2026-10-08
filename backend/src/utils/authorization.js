export function isSuperAdmin(user) {
  return user?.role === 'super_admin'
}
