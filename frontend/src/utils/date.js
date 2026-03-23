export const formatDateOnly = (dateValue, locale = 'en-US', options = {}) => {
  if (!dateValue) return ''

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString(locale, options)
}
