// Create button element
const button = document.createElement('button')
button.innerHTML = '→ GitRapid'
button.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  background: #0366d6;
  color: white;
  border: none;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(3, 102, 214, 0.3);
  transition: all 0.2s ease;
`

// Hover effects
button.addEventListener('mouseenter', () => {
    button.style.background = '#0256cc'
    button.style.transform = 'translateY(-1px)'
})

button.addEventListener('mouseleave', () => {
    button.style.background = '#0366d6'
    button.style.transform = 'translateY(0)'
})

// Click handler
button.addEventListener('click', () => {
    const currentUrl = window.location.href
    const gitrapidUrl = currentUrl.replace('github.com', 'gitrapid.com')
    window.location.href = gitrapidUrl
})

// Add button to page
document.body.appendChild(button)
