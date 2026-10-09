const offset = 96

function update() {
  const links = document.querySelectorAll('nav[aria-label="On this page"] a')
  if (!links.length) return

  let current = links[0]
  for (const link of links) {
    const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)))
    if (heading && heading.getBoundingClientRect().top <= offset) current = link
  }

  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
    current = links[links.length - 1]
  }

  for (const link of links) {
    if (link === current) link.setAttribute('aria-current', 'location')
    else link.removeAttribute('aria-current')
  }
}

let queued = false
window.addEventListener('scroll', () => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    update()
  })
}, { passive: true })
document.addEventListener('htmx:afterSettle', update)
update()
