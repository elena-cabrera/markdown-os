(() => {
  function slugify(text) {
    return text.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  }

  function collectHeadings() {
    const root = document.querySelector('#wysiwyg-editor .ProseMirror');
    if (!root) return [];
    const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const used = new Map();
    headings.forEach((heading) => {
      const base = slugify(heading.textContent || 'section') || 'section';
      const count = used.get(base) || 0;
      used.set(base, count + 1);
      heading.id = count ? `${base}-${count + 1}` : base;
    });
    return headings;
  }

  function generateTOC() {
    const toc = document.getElementById('toc');
    if (!toc) return;
    const headings = collectHeadings();
    if (!headings.length) {
      toc.innerHTML = '<p class="tree-empty-state">No headings</p>';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'root-list';
    headings.forEach((heading) => {
      const li = document.createElement('li');
      li.style.marginLeft = `${(Number(heading.tagName[1]) - 1) * 10}px`;
      const a = document.createElement('a');
      a.href = `#${heading.id}`;
      a.textContent = heading.textContent || 'section';
      a.addEventListener('click', (event) => {
        event.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.appendChild(a);
      ul.appendChild(li);
    });

    toc.innerHTML = '';
    toc.appendChild(ul);
  }

  window.generateTOC = generateTOC;
})();
