export const formatDateOnly = (value, locale = 'en-US', options = {}) => {
  if (!value) return ''

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (match) {
    const [, year, month, day] = match
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(locale, options)
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleDateString(locale, options)
}
