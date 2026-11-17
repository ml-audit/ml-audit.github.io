'use strict';
(() => {
  let data;
  const $ = id => document.getElementById(id);
  const route = volume => `#/jmlr/volume/${volume}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const years = items => items.length > 1 ? `${items[0]}–${items[items.length - 1]}` : String(items[0]);
  const element = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const mark = '<svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="5.2"/><path d="m12 12 3.5 3.5M8 5v4M8 10.7v.2"/></svg>';
  function renderCard(paper, index) {
    const card = element('article', 'paper-card');
    card.id = paper.record_id;
    card.setAttribute('aria-labelledby', `title-${paper.record_id}`);
    const topline = element('div', 'paper-topline');
    topline.append(element('span', 'paper-index', String(index + 1).padStart(2, '0')), element('span', '', `JMLR · ${paper.year}`), element('span', 'paper-finding-count', plural(paper.findings.length, 'finding')));
    const title = element('h3'); title.id = `title-${paper.record_id}`;
    const link = element('a', '', paper.title); link.href = paper.paper_url;
    const arrow = element('span', 'external-icon', '↗'); arrow.setAttribute('aria-hidden', 'true'); link.append(arrow); title.append(link);
    card.append(topline, title, element('p', 'content-label', 'ABSTRACT'), element('p', 'abstract', paper.abstract));
    const finding = element('div', 'finding-block');
    const label = element('div', 'finding-label'); label.innerHTML = mark;
    label.append(element('span', '', paper.findings.length === 1 ? 'GPT AUDIT FINDING' : 'GPT AUDIT FINDINGS'));
    finding.append(label);
    if (paper.findings.length === 1) finding.append(element('p', 'finding-text', paper.findings[0].summary));
    else {
      const list = element('ol', 'finding-list');
      paper.findings.forEach(item => { const li = element('li'); li.append(element('p', 'finding-text', item.summary)); list.append(li); });
      finding.append(list);
    }
    if (paper.review_status === 'incomplete') finding.append(element('p', 'incomplete-note', 'The GPT audit recorded this finding, but its overall review of this paper was incomplete.'));
    card.append(finding);
    return card;
  }
  function render() {
    if (!data) return;
    const match = /^#\/jmlr\/volume\/(\d+)\/?$/.exec(location.hash);
    const volume = match ? Number(match[1]) : 2;
    const info = data.volumes.find(v => v.volume === volume);
    if (!info) { location.replace(route(2)); return; }
    if (!match) history.replaceState(null, '', route(volume));
    const papers = data.papers.filter(p => p.volume === volume);
    $('volume-crumb').textContent = `Volume ${volume}`;
    $('volume-heading').firstChild.textContent = `Volume ${volume} `;
    $('volume-years').textContent = years(info.years);
    $('volume-count').textContent = `${plural(info.paper_count, 'flagged paper')} · ${plural(info.finding_count, 'finding')}`;
    $('mobile-volume').value = String(volume);
    document.querySelectorAll('.volume-link').forEach(a => { if (Number(a.dataset.volume) === volume) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    const currentLink = document.querySelector(`.volume-link[data-volume="${volume}"]`);
    if (currentLink && currentLink.offsetParent !== null) currentLink.scrollIntoView({block:'nearest'});
    const feed = $('papers');
    if (window.MathJax?.typesetClear) window.MathJax.typesetClear([feed]);
    feed.replaceChildren();
    if (papers.length) { const fragment = document.createDocumentFragment(); papers.forEach((p,i) => fragment.append(renderCard(p,i))); feed.append(fragment); }
    else { const empty = element('div','empty-state'); empty.innerHTML = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M7 5h13l5 5v17H7zM20 5v6h5M11 16h10M11 21h7"/></svg>'; empty.append(element('h3','','No findings published yet'),element('p','',`There are no published GPT audit findings for JMLR volume ${volume} in this release.`)); feed.append(empty); }
    if (window.MathJax?.startup?.promise) {
      window.MathJax.startup.promise = window.MathJax.startup.promise.then(() => window.MathJax.typesetPromise([feed]));
    }
    document.title = `JMLR · Volume ${volume} — ML-Audit`;
    $('announcement').textContent = `JMLR volume ${volume}. ${plural(info.paper_count,'flagged paper')}, ${plural(info.finding_count,'finding')}.`;
    $('share-volume').querySelector('span').textContent = 'Copy volume link';
  }
  async function load() {
    try {
      const response = await fetch('./data/jmlr.json'); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      $('total-papers').textContent = data.snapshot.papers_with_findings.toLocaleString();
      $('total-findings').textContent = data.snapshot.findings.toLocaleString();
      $('snapshot-date').textContent = `Release snapshot · ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}).format(new Date(data.snapshot.captured_at))}`;
      const nav = $('volume-nav'); const select = $('mobile-volume');
      data.volumes.forEach(v => {
        const a = element('a','volume-link'); a.href = route(v.volume); a.dataset.volume = String(v.volume);
        const label = element('span','volume-number',`Volume ${v.volume}`); label.append(element('small','',years(v.years))); a.append(label,element('span','volume-badge',String(v.paper_count))); nav.append(a);
        const option = element('option','',`Volume ${v.volume} · ${years(v.years)} · ${plural(v.paper_count,'paper')}`); option.value = String(v.volume); select.append(option);
      });
      render();
    } catch (error) {
      const box = element('div','error-message'); box.append(element('p','','The findings could not be loaded. Please try again.'));
      const retry = element('button','','Try again'); retry.addEventListener('click',() => location.reload()); box.append(retry); $('papers').replaceChildren(box); $('volume-count').textContent = 'Feed unavailable';
    }
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo({top:0,behavior:'instant'}); });
  $('mobile-volume').addEventListener('change', e => { location.hash = route(e.target.value); });
  $('share-volume').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('share-volume').querySelector('span').textContent = 'Link copied'; $('announcement').textContent = 'Volume link copied to clipboard.'; }
    catch { $('announcement').textContent = 'Copy this page’s address to share the volume.'; $('share-volume').querySelector('span').textContent = 'Use address bar link'; }
  });
  load();
})();
