function isBlocked (html) {
  return html.includes('<h1>Access Denied</h1>')
}

module.exports = {
  isBlocked
}
