'use strict';
(() => {
  let data, activeRoute = '', currentVolume = 1;
  const searches = new Map(), reportLoads = new Map();
  const $ = id => document.getElementById(id);
  const route = volume => '#/jmlr/volume/' + volume;
  const paperRoute = paper => route(paper.volume) + '/paper/' + encodeURIComponent(paper.record_id);
  const sectionRoute = (paper, id) => paperRoute(paper) + '?section=' + encodeURIComponent(id);
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
  const years = items => items.length > 1 ? items[0] + '–' + items[items.length - 1] : String(items[0]);
  const element = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const anchor = (text, href, cls) => { const el = element('a', cls, text); el.href = href; return el; };
  const canonical = hash => location.origin + location.pathname + hash;
  const sections = [['claim','Claim'],['explanation','What may be wrong'],['evidence','Evidence'],['impact','Why it matters'],['report','Full GPT report'],['sources','Paper sources']];
  function incompleteNote(paper) {
    return paper.review_status === 'incomplete'
      ? element('p', 'incomplete-note', 'Review incomplete. The GPT audit recorded these findings, but its overall review of this paper was not finished.') : null;
  }
  function summaryBlock(paper) {
    const block = element('div', 'finding-block');
    block.append(element('p', 'finding-label', paper.findings.length === 1 ? 'AUDIT FINDING' : 'AUDIT FINDINGS · ' + plural(paper.findings.length, 'finding')));
    if (paper.findings.length === 1) block.append(element('p', 'finding-text', paper.findings[0].summary));
    else {
      const list = element('ol', 'finding-list');
      paper.findings.forEach(f => { const li = element('li'); li.append(element('p', 'finding-text', f.summary)); list.append(li); });
      block.append(list);
    }
    const note = incompleteNote(paper); if (note) block.append(note);
    return block;
  }
  function abstractBlock(paper, detail = false) {
    const block = element('section', detail ? 'paper-abstract detail-abstract' : 'paper-abstract card-abstract');
    const heading = element(detail ? 'h2' : 'h4', 'abstract-label', 'Authors’ abstract');
    if (detail) { block.id = 'paper-abstract'; heading.id = 'abstract-heading'; block.setAttribute('aria-labelledby', heading.id); }
    const body = element('div', 'abstract-content source-markdown');
    if (paper.abstract_html) body.innerHTML = paper.abstract_html;
    else body.append(element('p', '', paper.abstract || 'Abstract not available.'));
    block.append(heading, body);
    if (detail) block.append(anchor('Abstract source: original paper', paper.abstract_source, 'abstract-source'));
    return block;
  }
  function renderCard(paper, index) {
    const card = element('article', 'paper-card'); card.id = paper.record_id;
    card.setAttribute('aria-labelledby', 'title-' + paper.record_id);
    const meta = element('div', 'paper-topline');
    meta.append(element('span', 'paper-index', String(index + 1).padStart(2, '0')), element('span', '', 'JMLR · ' + paper.year), element('span', 'paper-finding-count', plural(paper.findings.length, 'finding')));
    const title = element('h3'); title.id = 'title-' + paper.record_id;
    title.append(anchor(paper.title, paperRoute(paper), 'paper-detail-link'));
    const actions = element('div', 'card-actions');
    actions.append(anchor('View audit', paperRoute(paper), 'details-link'), anchor('Original paper', paper.paper_url, 'original-link'));
    card.append(meta, title, abstractBlock(paper), summaryBlock(paper), actions); return card;
  }
  async function copyLink(button, label, hash) {
    try {
      await navigator.clipboard.writeText(hash ? canonical(hash) : location.href);
      button.querySelector('span').textContent = 'Link copied';
      $('announcement').textContent = label + ' link copied to clipboard.';
    } catch {
      button.querySelector('span').textContent = 'Use address bar link';
      $('announcement').textContent = 'Copy this page’s address to share it.';
    }
  }
  function sourceVolume(volume) {
    if (!reportLoads.has(volume)) {
      reportLoads.set(volume, fetch(data.full_reports.volumes[String(volume)] + '?v=10').then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
      }).catch(error => { reportLoads.delete(volume); throw error; }));
    }
    return reportLoads.get(volume);
  }
  function downloadFinding(source, paper, index) {
    const url = URL.createObjectURL(new Blob([source.source_heading + '\n' + source.markdown], {type:'text/markdown;charset=utf-8'}));
    const link = anchor('', url); link.download = paper.record_id + '-finding-' + (index + 1) + '.md';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function measureEquations(container) {
    container.querySelectorAll('.source-math').forEach(span => {
      const available = span.parentElement && span.parentElement.clientWidth;
      if (available && span.getBoundingClientRect().width > available - 4) {
        span.classList.add('wide-inline-math'); span.tabIndex = 0;
        span.setAttribute('role','region'); span.setAttribute('aria-label','Equation; scroll horizontally to read all of it');
      }
    });
    container.querySelectorAll('.equation-block').forEach(box => {
      if (box.clientWidth && box.scrollWidth > box.clientWidth + 2) {
        box.tabIndex = 0; box.setAttribute('role','region'); box.setAttribute('aria-label','Equation; scroll horizontally to read all of it');
        if (!box.nextElementSibling || !box.nextElementSibling.classList.contains('equation-hint')) box.after(element('p','equation-hint','Scroll to view the full equation →'));
      }
    });
  }
  function typeset(container) {
    if (!window.MathJax || !window.MathJax.startup || !window.MathJax.startup.promise) return Promise.resolve();
    window.MathJax.startup.promise = window.MathJax.startup.promise.then(() => window.MathJax.typesetPromise([container])).then(() => measureEquations(container));
    return window.MathJax.startup.promise;
  }
  function currentSection() {
    return new URLSearchParams(location.hash.split('?')[1] || '').get('section');
  }
  function goToSection(focus = true) {
    const id = currentSection(); if (!id) return;
    const target = document.getElementById(id);
    const scope = $('home-view').hidden ? $('paper-view') : $('home-view');
    if (!target || !scope.contains(target)) return;
    let parent = target.parentElement;
    while (parent && parent !== $('paper-view')) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
    if (target.tagName === 'DETAILS') target.open = true;
    if (target.classList.contains('finding-sources')) target.querySelector('details').open = true;
    target.scrollIntoView({block:'start', behavior:'instant'});
    if (focus) { const heading=target.matches('h1,h2,h3,h4') ? target : target.querySelector('h2,h3,h4,summary'); const focusTarget=heading || target; focusTarget.tabIndex=-1; focusTarget.focus({preventScroll:true}); }
    document.querySelectorAll('.toc-links a').forEach(a => { if (a.hash === location.hash) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
    measureEquations(target);
  }
  function toc(paper) {
    const aside = element('aside', 'paper-toc');
    const disclosure = element('details', 'toc-disclosure'); disclosure.open = matchMedia('(min-width:1200px)').matches;
    disclosure.append(element('summary', '', 'On this page'));
    const nav = element('nav'); nav.setAttribute('aria-label', 'Paper contents');
    const list = element('ul', 'toc-links');
    const add = (text, id, cls) => { const li = element('li', cls); li.append(anchor(text, sectionRoute(paper, id))); list.append(li); };
    add('Authors’ abstract', 'paper-abstract');
    add('Audit summary', 'paper-overview');
    paper.findings.forEach((f, i) => {
      if (paper.findings.length > 1) add('Finding ' + (i + 1), 'finding-' + (i + 1), 'toc-finding-label');
      sections.forEach(pair => add(pair[1], 'finding-' + (i + 1) + '-' + pair[0]));
    });
    add('Review coverage', 'review-coverage');
    nav.append(list); disclosure.append(nav); aside.append(disclosure);
    aside.addEventListener('click', event => { if (event.target.closest('a') && innerWidth < 1200) disclosure.open = false; });
    return aside;
  }
  function overview(paper) {
    const box = element('section', 'paper-overview'); box.id = 'paper-overview';
    box.setAttribute('aria-labelledby', 'overview-heading');
    const h = element('h2', 'overview-kicker', 'Audit summary'); h.id = 'overview-heading'; box.append(h);
    const list = element(paper.findings.length > 1 ? 'ol' : 'div', 'overview-list');
    paper.findings.forEach((f, i) => {
      const item = element(paper.findings.length > 1 ? 'li' : 'div', 'overview-item');
      item.append(element('p', '', f.summary));
      if (paper.findings.length > 1) item.append(anchor('Read finding ' + (i + 1), sectionRoute(paper, 'finding-' + (i + 1))));
      list.append(item);
    });
    box.append(list);
    const actions = element('div', 'overview-actions');
    actions.append(anchor('Start with the reading guide', sectionRoute(paper, 'finding-1-claim'), 'overview-primary'), anchor('Go to the full GPT report', sectionRoute(paper, 'finding-1-report')));
    box.append(actions, element('p', 'overview-attribution', 'Editorial summaries of findings recorded by the GPT audit.'));
    return box;
  }
  function guideSection(section, paper, index, number) {
    const part = element('section', 'guide-section'); part.id = 'finding-' + (index + 1) + '-' + section.key;
    const h = element('h3'); h.append(element('span', 'section-number', String(number).padStart(2,'0')), document.createTextNode(section.title)); part.append(h);
    const body = element('div', 'source-markdown guide-content'); body.innerHTML = section.html;
    if (section.long_evidence) {
      const preview = element('div', 'source-markdown guide-evidence-preview');
      const intro = Array.from(body.querySelectorAll('p')).find(p => p.textContent.startsWith('For one block,'));
      const table = body.querySelector('.evidence-table-wrap');
      if (intro) preview.append(intro.cloneNode(true));
      if (table) preview.append(table.cloneNode(true));
      part.append(preview);
      const details = element('details','guide-more'); details.append(element('summary','','Follow the worked example, step by step'), body);
      details.addEventListener('toggle', () => { if (details.open) measureEquations(details); }); part.append(details);
    } else part.append(body);
    return part;
  }
  function renderFinding(finding, paper, index) {
    const article = element('article','finding-detail source-finding'); article.id = 'finding-' + (index + 1);
    article.dataset.findingId = finding.id; article.dataset.sourceSha256 = finding.source_body_sha256;
    article.append(element('p','finding-number','GPT AUDIT · FINDING ' + (index + 1)));
    const heading = element('h2', '', finding.title || 'Finding ' + (index + 1));
    if(finding.title_html)heading.innerHTML=finding.title_html;
    heading.id = 'finding-heading-' + (index + 1); article.setAttribute('aria-labelledby', heading.id); article.append(heading);
    if (paper.findings.length > 1) article.append(element('p','finding-lead',paper.findings[index].summary));
    const guide = element('div','reading-guide');
    guide.append(element('p','guide-label','READING GUIDE · BASED ON THE GPT AUDIT'));
    finding.reading_guide.sections.forEach((section, number) => guide.append(guideSection(section,paper,index,number + 1)));
    article.append(guide);
    const separator = element('header','report-separator'); separator.id = 'finding-' + (index + 1) + '-report';
    separator.append(element('p','report-kicker','DETAILED AUDIT REPORT'),element('h3','','Full GPT audit report'),element('p','','The technical argument follows, including the recorded assumptions, calculations, checks, and limitations.'));
    article.append(separator);
    const body = element('div','source-markdown source-report-body'); body.innerHTML = finding.html; article.append(body);
    const jump = element('nav','report-jump-links'); jump.setAttribute('aria-label','Sections in the full report');
    body.querySelectorAll('h3,h4,h5,h6').forEach((h, n) => {
      h.id = 'finding-' + (index + 1) + '-report-section-' + (n + 1);
      jump.append(anchor(h.textContent.replace(/[.:]\s*$/,''),sectionRoute(paper,h.id)));
    });
    if (jump.childElementCount) separator.append(jump);
    const sources = element('section','finding-sources'); sources.id = 'finding-' + (index + 1) + '-sources';
    sources.setAttribute('aria-label','Paper sources for finding ' + (index + 1));
    const details = element('details','sources-details'); details.open = index === 0;
    details.append(element('summary','','Paper sources & supporting files'));
    const links = element('ul','paper-source-links');
    finding.public_sources.forEach(source => { const li = element('li'); li.append(anchor(source.label, source.url)); links.append(li); }); details.append(links);
    if (finding.audit_files_notice) details.append(element('p','audit-file-availability',finding.audit_files_notice));
    sources.append(details); article.append(sources);
    const actions = element('div','finding-actions');
    const download = element('button','download-source','Download full finding text'); download.type = 'button'; download.addEventListener('click',()=>downloadFinding(finding,paper,index));
    actions.append(download,anchor('Back to the reading guide', sectionRoute(paper, 'finding-' + (index + 1) + '-claim'))); article.append(actions);
    return article;
  }
  function renderPaper(paper) {
    const view = $('paper-view'), header = element('header','detail-header');
    const breadcrumb = element('nav','breadcrumb'); breadcrumb.setAttribute('aria-label','Breadcrumb');
    breadcrumb.append(anchor('JMLR',route(paper.volume)), element('span','','/'),anchor('Volume ' + paper.volume,route(paper.volume)),element('span','','/'),element('span','','Paper audit'));
    header.append(breadcrumb,element('p','detail-meta','PUBLISHED PAPER · JMLR ' + paper.volume + ' (' + paper.year + ') · ' + plural(paper.findings.length,'finding')));
    const title = element('h1','detail-title',paper.title); title.id = 'detail-title'; header.append(title);
    const actions = element('div','detail-actions');
    actions.append(anchor('Original paper',paper.paper_url,'original-paper'),anchor('Open PDF',paper.pdf_url,'original-link'));
    const share = element('button','share-button'); share.id = 'share-paper'; share.type = 'button'; share.append(element('span','','Copy paper link')); share.addEventListener('click',()=>copyLink(share,'Paper',paperRoute(paper))); actions.append(share);
    header.append(actions); view.append(header);
    const note = incompleteNote(paper); if (note) view.append(note);
    const layout = element('div','detail-layout'), reading = element('div','detail-reading'); reading.append(abstractBlock(paper, true), overview(paper));
    const container = element('div'); container.id = 'source-findings'; container.dataset.loaded = 'false'; container.append(element('p','loading','Loading the reading guide and full report…')); reading.append(container);
    layout.append(toc(paper),reading); view.append(layout);
    async function showSource() {
      try {
        const volume = await sourceVolume(paper.volume); if (!view.contains(container)) return;
        const source = volume.papers.find(p => p.record_id === paper.record_id);
        if (!source || source.findings.length !== paper.findings.length || source.findings.some(f => !paper.findings.some(item=>item.id===f.id))) throw new Error('Report coverage mismatch');
        container.replaceChildren();
        source.findings.forEach((finding,index)=>container.append(renderFinding(finding,paper,index)));
        const coverage = element('details','coverage-details'); coverage.id = 'review-coverage';
        coverage.addEventListener('toggle', () => { if (coverage.open) measureEquations(coverage); });
        coverage.append(element('summary','','Review coverage & source notes'));
        if (source.preface_markdown.trim()) { const preface = element('div','source-preface'); const body = element('div','source-markdown'); body.innerHTML = source.preface_html; preface.append(body); coverage.append(preface); }
        coverage.append(element('p','','Reading guides are editorial explanations based on the GPT audit. The detailed reports retain the scientific arguments. Supporting audit files are not included in this release.'));
        if (source.preface_audit_files_notice) coverage.append(element('p','audit-file-availability',source.preface_audit_files_notice));
        container.append(coverage,anchor('Back to Volume ' + paper.volume,route(paper.volume),'back-link bottom-back'));
        container.dataset.loaded = 'true'; await typeset(view);
        if (view.contains(container)) goToSection(false);
      } catch (error) {
        if (!view.contains(container)) return;
        const box = element('div','error-message'); box.append(element('p','','The audit could not be loaded. Please try again.'));
        const retry = element('button','','Try again'); retry.type = 'button'; retry.addEventListener('click',showSource); box.append(retry); container.replaceChildren(box);
      }
    }
    showSource();
  }
  function renderPapers() {
    const all = data.papers.filter(p => p.volume === currentVolume), query = (searches.get(currentVolume) || '').trim().toLocaleLowerCase();
    const papers = all.filter(p => !query || (p.title + ' ' + p.findings.map(f=>f.summary).join(' ')).toLocaleLowerCase().includes(query));
    const feed = $('papers'); feed.replaceChildren(); $('clear-search').hidden = !query;
    $('search-status').textContent = query ? plural(papers.length,'matching paper') + ' in this volume' : '';
    if (papers.length) { const fragment = document.createDocumentFragment(); papers.forEach(p=>fragment.append(renderCard(p,all.indexOf(p)))); feed.append(fragment); }
    else {
      const empty = element('div','empty-state');
      empty.append(element('span','empty-icon',query ? '⌕' : '–'),element('h3','',query ? 'No papers match your search' : 'No findings published yet'));
      empty.append(element('p','',query ? 'Try a different title or a word from the finding.' : 'There are no published GPT audit findings for JMLR Volume ' + currentVolume + ' in this release.'));
      if (query) { const clear = element('button','details-link','Clear search'); clear.type='button'; clear.addEventListener('click',clearSearch); empty.append(clear); }
      else { const previous = data.volumes.filter(v=>v.volume<currentVolume && v.paper_count).at(-1); if(previous) empty.append(anchor('Browse Volume ' + previous.volume,route(previous.volume),'details-link')); }
      feed.append(empty);
    }
    typeset(feed);
  }
  function clearSearch() { searches.delete(currentVolume); $('paper-search').value=''; renderPapers(); $('paper-search').focus(); }
  function render(moveFocus = false) {
    if (!data) return;
    const base = location.hash.split('?')[0];
    if (base === activeRoute && currentSection()) { goToSection(moveFocus); return; }
    const home = !base || base === '#' || base === '#/';
    $('home-view').hidden = !home; $('collection-nav').hidden = home;
    for (const [id, selected] of [['home-nav', home], ['jmlr-nav', !home]]) {
      $(id).classList.toggle('active', selected);
      if (selected) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
    }
    if (home) {
      activeRoute = base;
      $('collection-intro').hidden = true; $('volume-view').hidden = true; $('paper-view').hidden = true;
      if (window.MathJax && window.MathJax.typesetClear) window.MathJax.typesetClear([$('papers'), $('paper-view')]);
      $('paper-view').replaceChildren();
      document.title = 'ML-Audit · Potential mistakes in machine learning papers';
      $('announcement').textContent = 'ML-Audit home. Explore published machine learning papers and learn how to read an audit.';
      if (currentSection()) goToSection(moveFocus);
      else { if (moveFocus) { $('home-title').tabIndex = -1; $('home-title').focus({preventScroll:true}); } window.scrollTo({top:0, behavior:'instant'}); }
      return;
    }
    const match = /^#\/jmlr\/volume\/(\d+)(?:\/paper\/([^/]+))?\/?$/.exec(base);
    const volume = match ? Number(match[1]) : 1;
    const info = data.volumes.find(v=>v.volume===volume);
    if (!info) { location.replace(route(1)); return; }
    if (!match) history.replaceState(null,'',route(volume));
    activeRoute = location.hash.split('?')[0]; currentVolume = volume;
    let recordId; try { recordId = match && match[2] ? decodeURIComponent(match[2]) : null; } catch { recordId = match[2]; }
    const paper = recordId ? data.papers.find(p=>p.volume===volume && p.record_id===recordId) : null, detail = Boolean(recordId);
    $('collection-intro').hidden=detail; $('volume-view').hidden=detail; $('paper-view').hidden=!detail; $('mobile-volume').value=String(volume);
    document.querySelectorAll('.volume-link').forEach(a=>{ if(Number(a.dataset.volume)===volume)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current'); });
    const currentLink = document.querySelector('.volume-link[data-volume="' + volume + '"]');
    if(currentLink && currentLink.offsetParent!==null) currentLink.scrollIntoView({block:'nearest'});
    const view=$('paper-view'); if(window.MathJax && window.MathJax.typesetClear)window.MathJax.typesetClear([$('papers'),view]);
    view.replaceChildren();
    if(detail) {
      if(paper)renderPaper(paper);
      else { const title=element('h1','detail-title','Paper not found');title.id='detail-title';view.append(title,element('p','','This paper is not in the published GPT audit findings for this volume.'),anchor('Back to Volume '+volume,route(volume),'back-link')); }
      document.title=paper ? paper.title+' — ML-Audit' : 'Paper not found — ML-Audit';
      $('announcement').textContent=paper ? paper.title+'. '+plural(paper.findings.length,'GPT audit finding')+'.' : 'Paper not found.';
    } else {
      $('volume-crumb').textContent='Volume '+volume; $('volume-heading').firstChild.textContent='Volume '+volume+' '; $('volume-years').textContent=years(info.years);
      $('volume-count').textContent=(info.paper_count + (info.paper_count===1 ? ' paper with findings' : ' papers with findings'))+' · '+plural(info.finding_count,'finding');
      $('paper-search').value=searches.get(volume)||''; renderPapers();
      const pagination=$('volume-pagination');pagination.replaceChildren();const index=data.volumes.findIndex(v=>v.volume===volume);
      if(index>0)pagination.append(anchor('Previous: Volume '+data.volumes[index-1].volume,route(data.volumes[index-1].volume),'previous-volume'));
      if(index<data.volumes.length-1)pagination.append(anchor('Next: Volume '+data.volumes[index+1].volume,route(data.volumes[index+1].volume),'next-volume'));
      document.title='JMLR · Volume '+volume+' — ML-Audit'; $('announcement').textContent='JMLR volume '+volume+'. '+(info.paper_count + (info.paper_count===1 ? ' paper with findings' : ' papers with findings'))+', '+plural(info.finding_count,'finding')+'.';
      $('share-volume').querySelector('span').textContent='Copy volume link';
    }
    if(moveFocus){const heading=$(detail?'detail-title':'volume-heading');heading.tabIndex=-1;heading.focus({preventScroll:true});}
    if(!currentSection())window.scrollTo({top:0,behavior:'instant'});
  }
  async function load() {
    try {
      const response=await fetch('./data/jmlr.json?v=10');if(!response.ok)throw new Error('HTTP '+response.status);data=await response.json();
      document.querySelectorAll('[data-count]').forEach(el => { const key = el.dataset.count; el.textContent = (key === 'papers' ? data.snapshot.papers_with_findings : key === 'findings' ? data.snapshot.findings : data.volumes.length).toLocaleString(); });
      $('total-papers').textContent=data.snapshot.papers_with_findings.toLocaleString();$('total-findings').textContent=data.snapshot.findings.toLocaleString();
      $('snapshot-date').textContent='Audit snapshot · '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}).format(new Date(data.snapshot.captured_at));
      const nav=$('volume-nav'),select=$('mobile-volume');
      data.volumes.forEach(v=>{
        const a=anchor('',route(v.volume),'volume-link');a.dataset.volume=String(v.volume);const label=element('span','volume-number','Volume '+v.volume);label.append(element('small','',years(v.years)));a.append(label,element('span','volume-badge',String(v.paper_count)));nav.append(a);
        const option=element('option','','Volume '+v.volume+' · '+years(v.years));option.value=String(v.volume);select.append(option);
      });render();
    }catch(error){$('home-data-status').textContent='Collection data could not be loaded. Please reload the page to try again.';const box=element('div','error-message');box.append(element('p','','The findings could not be loaded. Please try again.'));const retry=element('button','','Try again');retry.type='button';retry.addEventListener('click',()=>location.reload());box.append(retry);$('papers').replaceChildren(box);$('volume-count').textContent='Feed unavailable';}
  }
  window.addEventListener('hashchange',()=>{ document.querySelector('.volume-directory').open=false; render(true); });
  $('mobile-volume').addEventListener('change',event=>{location.hash=route(event.target.value);});
  $('share-volume').addEventListener('click',()=>copyLink($('share-volume'),'Volume',route(currentVolume)));
  $('paper-search').addEventListener('input',event=>{searches.set(currentVolume,event.target.value);renderPapers();});
  $('clear-search').addEventListener('click',clearSearch);
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('feed').focus();$('feed').scrollIntoView();});
  load();
})();
