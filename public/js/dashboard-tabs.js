document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('[data-tab]');
  const sections = document.querySelectorAll('[data-section]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(sec => sec.classList.add('hidden'));
      tab.classList.add('active');
      document.querySelector(`[data-section="${target}"]`)?.classList.remove('hidden');
    });
  });
});
