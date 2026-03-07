/* ============================================================
   WebScope Landing Page — main.js
   Terminal animation · Tabs · Scroll reveal · Navbar · Copy
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initHamburger();
  initTerminalAnimation();
  initTabs();
  initScrollReveal();
  initCopyButtons();
  initStickyCta();
});

/* ---------- NAVBAR SCROLL ---------- */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ---------- HAMBURGER MENU ---------- */
function initHamburger() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    links.classList.toggle('open');
  });

  // Close when clicking a link
  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('open');
      links.classList.remove('open');
    });
  });
}

/* ---------- TERMINAL TYPING ANIMATION ---------- */
function initTerminalAnimation() {
  const cmdEl = document.getElementById('terminalCmd');
  const cursorEl = document.getElementById('terminalCursor');
  const outputEl = document.getElementById('terminalOutput');
  if (!cmdEl || !outputEl) return;

  const command = 'webscope https://news.ycombinator.com';
  let i = 0;

  const output = `<span class="t-dim">Rendering page…</span>

<span class="t-highlight">Hacker News</span>  <span class="t-ref">[ref1]</span>

 1. <span class="t-highlight">Show HN: WebScope – text grid for AI</span>  <span class="t-ref">[ref2]</span>
    <span class="t-dim">▲ 245  ·  128 comments  ·  3h ago</span>

 2. <span class="t-highlight">Why LLMs don't need screenshots</span>  <span class="t-ref">[ref3]</span>
    <span class="t-dim">▲ 189  ·  87 comments  ·  5h ago</span>

 3. <span class="t-highlight">The future of agent-web interaction</span>  <span class="t-ref">[ref4]</span>
    <span class="t-dim">▲ 156  ·  64 comments  ·  7h ago</span>

<span class="t-dim">── 3 items · rendered in 82 ms ──</span>`;

  function typeChar() {
    if (i < command.length) {
      cmdEl.textContent += command[i];
      i++;
      setTimeout(typeChar, 35 + Math.random() * 40);
    } else {
      if (cursorEl) cursorEl.style.display = 'none';
      setTimeout(() => {
        outputEl.innerHTML = output;
        outputEl.style.opacity = '0';
        outputEl.style.transform = 'translateY(8px)';
        outputEl.style.transition = 'opacity 0.5s, transform 0.5s';
        requestAnimationFrame(() => {
          outputEl.style.opacity = '1';
          outputEl.style.transform = 'translateY(0)';
        });
      }, 400);
    }
  }

  // Start typing when the terminal is visible
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      setTimeout(typeChar, 600);
    }
  }, { threshold: 0.5 });

  const terminal = document.querySelector('.hero-terminal');
  if (terminal) {
    observer.observe(terminal);
  } else {
    setTimeout(typeChar, 600);
  }
}

/* ---------- TAB SWITCHING ---------- */
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('panel-' + target);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ---------- SCROLL REVEAL ---------- */
function initScrollReveal() {
  const elements = document.querySelectorAll('[data-reveal]');
  if (!elements.length) return;

  // Stagger child delays
  const groups = {};
  elements.forEach(el => {
    const parent = el.parentElement;
    if (!groups[parent]) groups[parent] = [];
    // We don't actually need grouping, just add transition delay
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach((el, index) => {
    // Check if sibling reveals to stagger
    const siblings = el.parentElement.querySelectorAll(':scope > [data-reveal]');
    if (siblings.length > 1) {
      const siblingIndex = Array.from(siblings).indexOf(el);
      el.style.transitionDelay = `${siblingIndex * 80}ms`;
    }
    observer.observe(el);
  });
}

/* ---------- COPY BUTTONS ---------- */
function initCopyButtons() {
  document.querySelectorAll('.install-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const bar = btn.closest('.install-bar');
      const cmd = bar ? bar.querySelector('.install-cmd') : null;
      const text = cmd ? cmd.textContent.trim() : 'npm install -g webscope';

      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        const svg = btn.querySelector('svg');
        if (svg) {
          const orig = svg.innerHTML;
          svg.innerHTML = '<path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
          setTimeout(() => {
            svg.innerHTML = orig;
            btn.classList.remove('copied');
          }, 2000);
        }
      });
    });
  });
}

/* ---------- STICKY BOTTOM CTA ---------- */
function initStickyCta() {
  const sticky = document.getElementById('stickyCta');
  const hero = document.querySelector('.hero');
  const footer = document.querySelector('.footer');
  if (!sticky || !hero) return;

  const observer = new IntersectionObserver(entries => {
    const heroVisible = entries.find(e => e.target === hero);
    const footerVisible = entries.find(e => e.target === footer);

    if (heroVisible) {
      sticky.classList.toggle('visible', !heroVisible.isIntersecting);
    }
    if (footerVisible && footerVisible.isIntersecting) {
      sticky.classList.remove('visible');
    }
  }, { threshold: 0 });

  observer.observe(hero);
  if (footer) observer.observe(footer);
}
