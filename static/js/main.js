/* ── DNA & RNA Sequence Analyzer · main.js ─────────────────────────────── */

const SAMPLES = {
  dna: 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG',
  rna: 'AUGGCCAUUGUAAUGGGCCGCUGAAAGGGU'
};

// ── DOM Refs ────────────────────────────────────────────────────────────────
const seqInput    = document.getElementById('sequence-input');
const seqLength   = document.getElementById('seq-length');
const dropZone    = document.getElementById('drop-zone');
const fileInput   = document.getElementById('file-input');
const btnAnalyze  = document.getElementById('btn-analyze');
const btnAnalyzeText = document.getElementById('btn-analyze-text');
const btnSpinner  = document.getElementById('btn-analyze-spinner');
const resultsSection = document.getElementById('results-section');

const labelNT = document.getElementById('label-non-template');
const labelT  = document.getElementById('label-template');

// ── Helpers ─────────────────────────────────────────────────────────────────
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function colorizeSequence(seq) {
  return [...seq].map(b => {
    const cls = { A:'base-A', T:'base-T', G:'base-G', C:'base-C', U:'base-U' }[b];
    return cls ? `<span class="${cls}">${b}</span>` : b;
  }).join('');
}

function chunkSeq(seq, n = 10) {
  const chunks = [];
  for (let i = 0; i < seq.length; i += n) chunks.push(seq.slice(i, i + n));
  return chunks.join(' ');
}

function explainBox(text) {
  return `<div class="explain-box">💡 <strong>What's happening:</strong> ${text}</div>`;
}

function seqDisplay(label, seq) {
  return `
    <div>
      <span class="seq-label">${label}</span>
      <div class="seq-display">${colorizeSequence(chunkSeq(seq))}</div>
      <small style="color:var(--c-muted);font-size:.72rem">${seq.length} bases</small>
    </div>`;
}

// ── Sequence length counter ──────────────────────────────────────────────────
seqInput.addEventListener('input', () => {
  const v = seqInput.value.replace(/[^A-Za-z]/g, '');
  seqLength.textContent = `${v.length} base${v.length !== 1 ? 's' : ''}`;
});

// ── Sample buttons ───────────────────────────────────────────────────────────
document.getElementById('btn-sample-dna').addEventListener('click', () => {
  seqInput.value = SAMPLES.dna;
  seqInput.dispatchEvent(new Event('input'));
});
document.getElementById('btn-sample-rna').addEventListener('click', () => {
  seqInput.value = SAMPLES.rna;
  seqInput.dispatchEvent(new Event('input'));
});
document.getElementById('btn-clear').addEventListener('click', () => {
  seqInput.value = '';
  seqInput.dispatchEvent(new Event('input'));
  hide(resultsSection);
});

// ── Radio cards ──────────────────────────────────────────────────────────────
document.querySelectorAll('.radio-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    card.querySelector('input').checked = true;
  });
});

// ── Drag & Drop ──────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    seqInput.value = e.target.result;
    seqInput.dispatchEvent(new Event('input'));
  };
  reader.readAsText(file);
}

// ── Analyze ──────────────────────────────────────────────────────────────────
btnAnalyze.addEventListener('click', runAnalysis);

async function runAnalysis() {
  const sequence = seqInput.value.trim();
  if (!sequence) { alert('Please enter a sequence first.'); return; }

  const strand_type = document.querySelector('input[name="strand"]:checked').value;

  // Loading state
  btnAnalyze.disabled = true;
  btnAnalyzeText.hidden = true;
  show(btnSpinner);

  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence, strand_type })
    });
    const data = await resp.json();
    renderResults(data);
  } catch (err) {
    alert('Network error: ' + err.message);
  } finally {
    btnAnalyze.disabled = false;
    btnAnalyzeText.hidden = false;
    hide(btnSpinner);
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderResults(data) {
  show(resultsSection);

  // -- Detection
  renderDetection(data);

  if (data.error || data.seq_type === 'invalid') {
    ['card-transcription','card-translation','card-amino','card-protein'].forEach(id => {
      hide(document.getElementById(id));
    });
    return;
  }

  // -- Transcription
  renderTranscription(data);
  // -- Translation
  renderTranslation(data);
  // -- Amino Acids
  renderAminoAcids(data);
  // -- Protein + DB lookup
  renderProtein(data);

  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Detection ────────────────────────────────────────────────────────────────
function renderDetection(data) {
  const card = document.getElementById('card-detection');
  const cont = document.getElementById('detection-content');
  show(card);

  let html = '<div class="p-section">';

  if (data.seq_type === 'invalid') {
    html += `<div class="detect-banner invalid"><span class="detect-icon">❌</span>Invalid Sequence Detected</div>`;
    html += explainBox(data.detection_explanation);
    if (data.invalid_chars?.length) {
      html += `<p style="font-size:.85rem;color:var(--c-muted);margin-top:.5rem">Invalid characters found: <strong style="color:var(--c-accent3)">${data.invalid_chars.join(', ')}</strong></p>`;
    }
  } else {
    const isDNA = data.seq_type === 'dna';
    html += `<div class="detect-banner ${data.seq_type}">
      <span class="detect-icon">${isDNA ? '🧬' : '🔬'}</span>
      Sequence identified as <strong>${isDNA ? 'DNA' : 'RNA'}</strong>
    </div>`;
    html += explainBox(data.detection_explanation);
    html += seqDisplay('Input Sequence', data.sequence);
  }

  html += '</div>';
  cont.innerHTML = html;
}

// ── Transcription ─────────────────────────────────────────────────────────────
function renderTranscription(data) {
  const card = document.getElementById('card-transcription');
  const cont = document.getElementById('transcription-content');
  show(card);

  let html = '<div class="p-section">';

  const strandLabel = {
    non_template: 'Non-template (Coding) Strand',
    template: 'Template (Antisense) Strand',
    rna_input: 'RNA Input (already mRNA)'
  }[data.strand_type] || '';

  if (data.strand_type !== 'rna_input') {
    html += `<p style="font-size:.82rem;color:var(--c-muted);margin-bottom:1rem">Strand type provided: <strong style="color:var(--c-text)">${strandLabel}</strong></p>`;
  }

  html += explainBox(data.transcription_explanation);
  if (data.strand_type !== 'rna_input') {
    html += seqDisplay('Input DNA Sequence', data.sequence);
    html += '<div style="height:.75rem"></div>';
  }
  html += seqDisplay('mRNA Sequence (result of transcription)', data.mrna);
  html += '</div>';
  cont.innerHTML = html;
}

// ── Translation ───────────────────────────────────────────────────────────────
function renderTranslation(data) {
  const card = document.getElementById('card-translation');
  const cont = document.getElementById('translation-content');
  show(card);

  const explanation = `Translation is the process of reading the mRNA sequence and building a chain of amino acids. 
    The ribosome reads the mRNA in groups of <strong>three bases called codons</strong>. 
    Each codon maps to a specific amino acid. The ribosome starts at the <strong style="color:var(--c-accent2)">AUG start codon (Met)</strong> 
    and continues until it hits a <strong style="color:var(--c-accent3)">stop codon (UAA, UAG, or UGA)</strong>, 
    which signals the end of the protein.`;

  let html = '<div class="p-section">';
  html += explainBox(explanation);
  html += '<p style="font-size:.82rem;color:var(--c-muted);margin-bottom:.75rem">Each chip below shows one codon and the amino acid it encodes.</p>';
  html += '<div class="codon-grid">';

  for (const c of data.codons) {
    const extraClass = c.is_start ? 'is-start' : c.is_stop ? 'is-stop' : '';
    const badge = c.is_start
      ? '<span class="codon-badge">START</span>'
      : c.is_stop ? '<span class="codon-badge">STOP</span>' : '';
    html += `<div class="codon-chip ${extraClass}">
      <span class="codon-seq">${c.codon}</span>
      <span class="codon-aa">${c.three}</span>
      ${badge}
    </div>`;
  }

  if (data.codons.length === 0) {
    html += '<p style="color:var(--c-muted);font-size:.85rem">No complete codons found in mRNA.</p>';
  }

  html += '</div>';
  const startCount = data.codons.filter(c => c.is_start).length;
  const stopCount  = data.codons.filter(c => c.is_stop).length;
  html += `<p style="font-size:.78rem;color:var(--c-muted);padding:.5rem 0">
    ${data.codons.length} codons total · ${startCount} start codon(s) · ${stopCount} stop codon(s)
  </p>`;
  html += '</div>';
  cont.innerHTML = html;
}

// ── Amino Acids ────────────────────────────────────────────────────────────────
function renderAminoAcids(data) {
  const card = document.getElementById('card-amino');
  const cont = document.getElementById('amino-content');
  show(card);

  const explanation = `Amino acids are the building blocks of proteins. During translation, 
    each codon in the mRNA is matched to a specific amino acid. 
    The chain of amino acids produced is called a <strong>polypeptide chain</strong>. 
    Once this chain folds into its 3D shape, it becomes a functional <strong>protein</strong>. 
    There are 20 standard amino acids, each with unique chemical properties that determine how the protein folds and functions.`;

  let html = '<div class="p-section">';
  html += explainBox(explanation);

  if (data.amino_acids.length === 0) {
    html += '<div class="error-box">No amino acid chain could be built. A start codon (AUG) may be missing or the sequence is too short.</div>';
  } else {
    html += `<p style="font-size:.82rem;color:var(--c-muted);margin-bottom:.75rem">${data.amino_acids.length} amino acid(s) in the polypeptide chain</p>`;
    html += '<div class="aa-grid">';
    for (const aa of data.amino_acids) {
      html += `<div class="aa-chip">
        <span class="aa-one">${aa.one}</span>
        <span class="aa-three">${aa.three}</span>
        <span class="aa-name">${aa.name}</span>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  cont.innerHTML = html;
}

// ── Protein ────────────────────────────────────────────────────────────────────
function renderProtein(data) {
  const card = document.getElementById('card-protein');
  const cont = document.getElementById('protein-content');
  show(card);

  const p = data.protein;

  const explanation = `A protein is a large, complex molecule made up of one or more polypeptide chains that have folded into a specific 3D shape. 
    The sequence of amino acids determines how the chain folds, and the shape determines the protein's function. 
    Proteins do almost everything in the body — from catalysing chemical reactions (enzymes) to defending against disease (antibodies). 
    The <strong>database lookup</strong> below searches UniProt, the world's leading protein database, for real proteins similar to the one derived from your sequence.`;

  let html = '';

  if (!p || p.length === 0) {
    html = '<div class="protein-section"><div class="error-box">No protein could be characterised. Please ensure your sequence contains a valid coding region.</div></div>';
    cont.innerHTML = html;
    return;
  }

  html += '<div class="protein-section">';
  html += explainBox(explanation);

  // Sequence
  html += '<div class="protein-seq-wrap">';
  html += seqDisplay('Protein Sequence (one-letter amino acid codes)', p.sequence);
  html += '</div>';

  // Stats
  html += '<div class="stats-grid">';
  html += statCard(p.length, 'Amino Acids');
  html += statCard(p.approx_mw ? p.approx_mw.toLocaleString() + ' Da' : '—', 'Approx. Mol. Weight');
  html += statCard(p.polar, 'Polar Residues');
  html += statCard(p.nonpolar, 'Non-polar Residues');
  html += statCard(p.positive_charged, 'Positively Charged');
  html += statCard(p.negative_charged, 'Negatively Charged');
  html += statCard(p.essential_count, 'Essential AAs');
  html += '</div>';

  // Composition
  const sorted = Object.entries(p.composition).sort((a, b) => b[1] - a[1]).slice(0, 10);
  html += '<div class="comp-bar-wrap"><h4>Amino Acid Composition (top 10)</h4>';
  const maxCount = sorted[0]?.[1] || 1;
  for (const [name, count] of sorted) {
    const pct = Math.round((count / maxCount) * 100);
    html += `<div class="comp-row">
      <span class="comp-name">${name}</span>
      <div class="comp-bar-bg"><div class="comp-bar-fill" style="width:${pct}%"></div></div>
      <span class="comp-count">${count}</span>
    </div>`;
  }
  html += '</div></div>';

  cont.innerHTML = html;

  // DB lookup (async)
  const dbSection = document.createElement('div');
  dbSection.className = 'db-section';
  dbSection.innerHTML = `
    <h3>🔍 UniProt Database Lookup</h3>
    <p class="explain-box" style="margin-bottom:.75rem">
      💡 <strong>What is UniProt?</strong> UniProt is the world's most comprehensive protein database, 
      containing millions of protein sequences with functional annotations from biological research. 
      We are searching it now for proteins similar to yours.
    </p>
    <div class="db-loading"><div class="spinner" style="border-top-color:var(--c-accent1);border-color:rgba(88,166,255,.2)"></div> Querying UniProt database…</div>`;
  cont.appendChild(dbSection);

  fetchDatabaseResults(p.sequence, dbSection);
}

function statCard(val, label) {
  return `<div class="stat-card"><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div>`;
}

async function fetchDatabaseResults(sequence, container) {
  try {
    const resp = await fetch('/api/database_lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence })
    });
    const data = await resp.json();

    let html = '<h3>🔍 UniProt Database Lookup</h3>';
    html += `<div class="explain-box" style="margin-bottom:.75rem">
      💡 <strong>What is UniProt?</strong> UniProt is the world's most comprehensive protein database, 
      containing millions of protein sequences. The results below show real proteins 
      whose sequences share similarity with your derived protein sequence — indicating what biological function your protein may perform.
    </div>`;

    if (data.error) {
      html += `<div class="db-note">⚠️ Could not reach UniProt at this time (${data.error}). The database may be temporarily unavailable. Try querying <a href="https://www.uniprot.org/blast/" target="_blank" rel="noopener" style="color:var(--c-accent1)">UniProt BLAST</a> directly with the protein sequence above.</div>`;
    } else if (!data.results || data.results.length === 0) {
      html += `<div class="db-note">No closely matching proteins found in UniProt for this sequence. You can try a manual search on <a href="https://www.uniprot.org/blast/" target="_blank" rel="noopener" style="color:var(--c-accent1)">UniProt BLAST</a>.</div>`;
    } else {
      html += '<div class="db-results">';
      for (const r of data.results) {
        html += `<div class="db-card">
          <div class="db-card-name">${r.name}</div>
          <div class="db-card-org">🦠 ${r.organism}</div>
          <div class="db-card-func">${r.function || 'No functional annotation available.'}</div>
          <div class="db-card-id">UniProt ID: ${r.id} · Length: ${r.length} aa</div>
        </div>`;
      }
      html += '</div>';
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<h3>🔍 UniProt Database Lookup</h3>
      <div class="db-note">⚠️ Network error while querying the database: ${err.message}</div>`;
  }
}
