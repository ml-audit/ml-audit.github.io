'use strict';
(() => {
  let data;
  const $ = id => document.getElementById(id);
  const route = volume => `#/jmlr/volume/${volume}`;
  const paperRoute = paper => `${route(paper.volume)}/paper/${encodeURIComponent(paper.record_id)}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const years = items => items.length > 1 ? `${items[0]}–${items[items.length - 1]}` : String(items[0]);
  const element = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const mark = '<svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="5.2"/><path d="m12 12 3.5 3.5M8 5v4M8 10.7v.2"/></svg>';
  function anchor(text, href, cls) {
    const link = element('a', cls, text); link.href = href; return link;
  }
  function incompleteNote(paper) {
    return paper.review_status === 'incomplete'
      ? element('p', 'incomplete-note', 'The GPT audit recorded these findings, but its overall review of this paper was incomplete.') : null;
  }
  function summaryBlock(paper) {
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
    const note = incompleteNote(paper); if (note) finding.append(note);
    return finding;
  }
  function renderCard(paper, index) {
    const card = element('article', 'paper-card');
    card.id = paper.record_id;
    card.setAttribute('aria-labelledby', `title-${paper.record_id}`);
    const topline = element('div', 'paper-topline');
    topline.append(element('span', 'paper-index', String(index + 1).padStart(2, '0')), element('span', '', `JMLR · ${paper.year}`), element('span', 'paper-finding-count', plural(paper.findings.length, 'finding')));
    const title = element('h3'); title.id = `title-${paper.record_id}`;
    title.append(anchor(paper.title, paperRoute(paper), 'paper-detail-link'));
    const actions = element('div', 'card-actions');
    actions.append(anchor('Read audit details →', paperRoute(paper), 'details-link'), anchor('Original paper ↗', paper.paper_url, 'original-link'));
    card.append(topline, title, summaryBlock(paper), actions);
    return card;
  }
  async function copyLink(button, label) {
    try { await navigator.clipboard.writeText(location.href); button.querySelector('span').textContent = 'Link copied'; $('announcement').textContent = `${label} link copied to clipboard.`; }
    catch { $('announcement').textContent = 'Copy this page’s address to share it.'; button.querySelector('span').textContent = 'Use address bar link'; }
  }
  const reportLoads = new Map();
  function sourceVolume(volume) {
    if (!reportLoads.has(volume)) {
      const url = data.full_reports.volumes[String(volume)];
      reportLoads.set(volume, fetch(`${url}?v=5`).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).catch(error => { reportLoads.delete(volume); throw error; }));
    }
    return reportLoads.get(volume);
  }
  function downloadFinding(source, paper, index) {
    const text = `${source.source_heading}\n${source.markdown}`;
    const url = URL.createObjectURL(new Blob([text], {type:'text/markdown;charset=utf-8'}));
    const link = anchor('', url); link.download = `${paper.record_id}-finding-${index + 1}.md`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderPaper(paper) {
    const view = $('paper-view');
    view.append(anchor(`← Back to Volume ${paper.volume}`, route(paper.volume), 'back-link'));
    const breadcrumb = element('nav', 'breadcrumb'); breadcrumb.setAttribute('aria-label', 'Breadcrumb');
    const slash = () => { const span = element('span', '', '/'); span.setAttribute('aria-hidden', 'true'); return span; };
    breadcrumb.append(anchor('JMLR', route(2)), slash(), anchor(`Volume ${paper.volume}`, route(paper.volume)), slash(), element('span', '', 'Paper details'));
    const header = element('header', 'detail-header');
    header.append(breadcrumb, element('p', 'detail-meta', `JMLR · Volume ${paper.volume} · ${paper.year} · ${plural(paper.findings.length, 'finding')}`));
    const title = element('h1', 'detail-title', paper.title); title.id = 'detail-title'; header.append(title);
    const actions = element('div', 'detail-actions');
    actions.append(anchor('Original paper ↗', paper.paper_url, 'original-paper'), anchor('PDF ↗', paper.pdf_url, 'original-link'));
    const share = element('button', 'share-button'); share.id = 'share-paper'; share.type = 'button'; share.setAttribute('aria-label', 'Copy a link to this paper’s audit details'); share.append(element('span', '', 'Copy paper link')); share.addEventListener('click', () => copyLink(share, 'Paper')); actions.append(share);
    header.append(actions); view.append(header);
    const note = incompleteNote(paper); if (note) view.append(note);
    const provenance = element('div', 'full-report-notice');
    provenance.append(element('strong', '', 'Full GPT audit report'), element('p', '', 'The source wording is preserved below, including the derivations, verification, confidence, and limitations. Only layout and equation rendering are formatted for the website. Private file references are explicitly marked as omitted.'));
    view.append(provenance);
    const container = element('div'); container.id = 'source-findings'; container.dataset.loaded = 'false'; container.append(element('p', 'loading', 'Loading the full audit report…')); view.append(container);
    async function showSource() {
      try {
        const volume = await sourceVolume(paper.volume);
        if (!view.contains(container)) return;
        const source = volume.papers.find(p => p.record_id === paper.record_id);
        if (!source || source.findings.length !== paper.findings.length || source.findings.some(f => !paper.findings.some(item => item.id === f.id))) throw new Error('Report coverage mismatch');
        container.replaceChildren();
        if (source.preface_markdown.trim()) {
          const preface = element('section', 'source-preface');
          preface.append(element('h2', '', 'Review coverage and scope'));
          const body = element('div', 'source-markdown'); body.innerHTML = source.preface_html; preface.append(body); container.append(preface);
        }
        source.findings.forEach((finding, index) => {
          const article = element('article', 'finding-detail source-finding'); article.id = `finding-${index + 1}`; article.dataset.findingId = finding.id; article.dataset.sourceSha256 = finding.source_body_sha256;
          const heading = element('h2', '', finding.title ? `Finding ${index + 1} · ${finding.title}` : `Finding ${index + 1}`); heading.id = `finding-heading-${index + 1}`; article.setAttribute('aria-labelledby', heading.id); article.append(heading);
          const body = element('div', 'source-markdown source-report-body'); body.innerHTML = finding.html; article.append(body);
          const download = element('button', 'download-source', 'Download this finding’s text'); download.type = 'button'; download.addEventListener('click', () => downloadFinding(finding, paper, index)); article.append(download);
          container.append(article);
        });
        container.append(anchor(`← Back to Volume ${paper.volume}`, route(paper.volume), 'back-link bottom-back'));
        container.dataset.loaded = 'true'; typeset(view);
      } catch (error) {
        if (!view.contains(container)) return;
        const box = element('div', 'error-message'); box.append(element('p', '', 'The full audit report could not be loaded.'));
        const retry = element('button', '', 'Try again'); retry.type = 'button'; retry.addEventListener('click', showSource); box.append(retry); container.replaceChildren(box);
      }
    }
    showSource();
  }
  function typeset(container) {
    if (window.MathJax?.startup?.promise) {
      window.MathJax.startup.promise = window.MathJax.startup.promise.then(() => window.MathJax.typesetPromise([container])).then(() => {
        container.querySelectorAll('.source-math').forEach(span => {
          const available = span.parentElement?.clientWidth;
          if (available && span.getBoundingClientRect().width > available - 4) {
            span.classList.add('wide-inline-math'); span.tabIndex = 0;
            span.setAttribute('role', 'region'); span.setAttribute('aria-label', 'Equation; scroll horizontally to read all of it');
          }
        });
        container.querySelectorAll('.equation-block').forEach(box => {
          if (box.scrollWidth > box.clientWidth + 2) {
            box.tabIndex = 0; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Equation; scroll horizontally to read all of it');
            if (!box.nextElementSibling?.classList.contains('equation-hint')) box.after(element('p', 'equation-hint', 'Scroll to view the full equation →'));
          }
        });
      });
    }
  }
  function render(moveFocus = false) {
    if (!data) return;
    const match = /^#\/jmlr\/volume\/(\d+)(?:\/paper\/([^/]+))?\/?$/.exec(location.hash);
    const volume = match ? Number(match[1]) : 2;
    const info = data.volumes.find(v => v.volume === volume);
    if (!info) { location.replace(route(2)); return; }
    if (!match) history.replaceState(null, '', route(volume));
    let recordId;
    try { recordId = match?.[2] ? decodeURIComponent(match[2]) : null; } catch { recordId = match[2]; }
    const paper = recordId ? data.papers.find(p => p.volume === volume && p.record_id === recordId) : null;
    const detail = Boolean(recordId);
    $('collection-intro').hidden = detail;
    $('volume-view').hidden = detail;
    $('paper-view').hidden = !detail;
    $('mobile-volume').value = String(volume);
    document.querySelectorAll('.volume-link').forEach(a => { if (Number(a.dataset.volume) === volume) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    const currentLink = document.querySelector(`.volume-link[data-volume="${volume}"]`);
    if (currentLink && currentLink.offsetParent !== null) currentLink.scrollIntoView({block:'nearest'});
    const feed = $('papers'), view = $('paper-view');
    if (window.MathJax?.typesetClear) window.MathJax.typesetClear([feed, view]);
    feed.replaceChildren(); view.replaceChildren();
    if (detail) {
      if (paper) renderPaper(paper);
      else { const title = element('h1', 'detail-title', 'Paper not found'); title.id = 'detail-title'; view.append(title, element('p', '', 'This paper is not in the published GPT audit findings for this volume.'), anchor(`← Back to Volume ${volume}`, route(volume), 'back-link')); }
      if (!paper) typeset(view);
      document.title = paper ? `${paper.title} — ML-Audit` : 'Paper not found — ML-Audit';
      $('announcement').textContent = paper ? `${paper.title}. ${plural(paper.findings.length, 'GPT audit finding')}.` : 'Paper not found.';
    } else {
      const papers = data.papers.filter(p => p.volume === volume);
      $('volume-crumb').textContent = `Volume ${volume}`;
      $('volume-heading').firstChild.textContent = `Volume ${volume} `;
      $('volume-years').textContent = years(info.years);
      $('volume-count').textContent = `${plural(info.paper_count, 'flagged paper')} · ${plural(info.finding_count, 'finding')}`;
      if (papers.length) { const fragment = document.createDocumentFragment(); papers.forEach((p,i) => fragment.append(renderCard(p,i))); feed.append(fragment); }
      else { const empty = element('div','empty-state'); empty.innerHTML = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M7 5h13l5 5v17H7zM20 5v6h5M11 16h10M11 21h7"/></svg>'; empty.append(element('h3','','No findings published yet'),element('p','',`There are no published GPT audit findings for JMLR volume ${volume} in this release.`)); feed.append(empty); }
      typeset(feed);
      document.title = `JMLR · Volume ${volume} — ML-Audit`;
      $('announcement').textContent = `JMLR volume ${volume}. ${plural(info.paper_count,'flagged paper')}, ${plural(info.finding_count,'finding')}.`;
      $('share-volume').querySelector('span').textContent = 'Copy volume link';
    }
    if (moveFocus) { const heading = $(detail ? 'detail-title' : 'volume-heading'); heading.tabIndex = -1; heading.focus({preventScroll: true}); }
  }
  async function load() {
    try {
      const response = await fetch('./data/jmlr.json?v=5'); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      $('total-papers').textContent = data.snapshot.papers_with_findings.toLocaleString();
      $('total-findings').textContent = data.snapshot.findings.toLocaleString();
      $('snapshot-date').textContent = `Audit snapshot · ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(data.snapshot.captured_at))}`;
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
  window.addEventListener('hashchange', () => { render(true); window.scrollTo({top:0,behavior:'instant'}); });
  $('mobile-volume').addEventListener('change', e => { location.hash = route(e.target.value); });
  $('share-volume').addEventListener('click', () => copyLink($('share-volume'), 'Volume'));
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); $('feed').focus(); $('feed').scrollIntoView(); });
  load();
})();
