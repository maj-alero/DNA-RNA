from flask import Flask, render_template, request, jsonify
import os
import re
import json
import urllib.request
import urllib.parse
import urllib.error
import time

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max

# ── Codon Table ───────────────────────────────────────────────────────────────
CODON_TABLE = {
    'UUU': ('Phenylalanine', 'Phe', 'F'), 'UUC': ('Phenylalanine', 'Phe', 'F'),
    'UUA': ('Leucine',       'Leu', 'L'), 'UUG': ('Leucine',       'Leu', 'L'),
    'CUU': ('Leucine',       'Leu', 'L'), 'CUC': ('Leucine',       'Leu', 'L'),
    'CUA': ('Leucine',       'Leu', 'L'), 'CUG': ('Leucine',       'Leu', 'L'),
    'AUU': ('Isoleucine',    'Ile', 'I'), 'AUC': ('Isoleucine',    'Ile', 'I'),
    'AUA': ('Isoleucine',    'Ile', 'I'), 'AUG': ('Methionine',    'Met', 'M'),
    'GUU': ('Valine',        'Val', 'V'), 'GUC': ('Valine',        'Val', 'V'),
    'GUA': ('Valine',        'Val', 'V'), 'GUG': ('Valine',        'Val', 'V'),
    'UCU': ('Serine',        'Ser', 'S'), 'UCC': ('Serine',        'Ser', 'S'),
    'UCA': ('Serine',        'Ser', 'S'), 'UCG': ('Serine',        'Ser', 'S'),
    'CCU': ('Proline',       'Pro', 'P'), 'CCC': ('Proline',       'Pro', 'P'),
    'CCA': ('Proline',       'Pro', 'P'), 'CCG': ('Proline',       'Pro', 'P'),
    'ACU': ('Threonine',     'Thr', 'T'), 'ACC': ('Threonine',     'Thr', 'T'),
    'ACA': ('Threonine',     'Thr', 'T'), 'ACG': ('Threonine',     'Thr', 'T'),
    'GCU': ('Alanine',       'Ala', 'A'), 'GCC': ('Alanine',       'Ala', 'A'),
    'GCA': ('Alanine',       'Ala', 'A'), 'GCG': ('Alanine',       'Ala', 'A'),
    'UAU': ('Tyrosine',      'Tyr', 'Y'), 'UAC': ('Tyrosine',      'Tyr', 'Y'),
    'UAA': ('Stop',          'Stop','*'), 'UAG': ('Stop',          'Stop','*'),
    'CAU': ('Histidine',     'His', 'H'), 'CAC': ('Histidine',     'His', 'H'),
    'CAA': ('Glutamine',     'Gln', 'Q'), 'CAG': ('Glutamine',     'Gln', 'Q'),
    'AAU': ('Asparagine',    'Asn', 'N'), 'AAC': ('Asparagine',    'Asn', 'N'),
    'AAA': ('Lysine',        'Lys', 'K'), 'AAG': ('Lysine',        'Lys', 'K'),
    'GAU': ('Aspartate',     'Asp', 'D'), 'GAC': ('Aspartate',     'Asp', 'D'),
    'GAA': ('Glutamate',     'Glu', 'E'), 'GAG': ('Glutamate',     'Glu', 'E'),
    'UGU': ('Cysteine',      'Cys', 'C'), 'UGC': ('Cysteine',      'Cys', 'C'),
    'UGA': ('Stop',          'Stop','*'), 'UGG': ('Tryptophan',    'Trp', 'W'),
    'CGU': ('Arginine',      'Arg', 'R'), 'CGC': ('Arginine',      'Arg', 'R'),
    'CGA': ('Arginine',      'Arg', 'R'), 'CGG': ('Arginine',      'Arg', 'R'),
    'AGU': ('Serine',        'Ser', 'S'), 'AGC': ('Serine',        'Ser', 'S'),
    'AGA': ('Arginine',      'Arg', 'R'), 'AGG': ('Arginine',      'Arg', 'R'),
    'GGU': ('Glycine',       'Gly', 'G'), 'GGC': ('Glycine',       'Gly', 'G'),
    'GGA': ('Glycine',       'Gly', 'G'), 'GGG': ('Glycine',       'Gly', 'G'),
}

AA_PROPERTIES = {
    'Alanine':       {'polar': False, 'charge': 'neutral',  'essential': False},
    'Arginine':      {'polar': True,  'charge': 'positive', 'essential': True},
    'Asparagine':    {'polar': True,  'charge': 'neutral',  'essential': False},
    'Aspartate':     {'polar': True,  'charge': 'negative', 'essential': False},
    'Cysteine':      {'polar': True,  'charge': 'neutral',  'essential': False},
    'Glutamate':     {'polar': True,  'charge': 'negative', 'essential': False},
    'Glutamine':     {'polar': True,  'charge': 'neutral',  'essential': False},
    'Glycine':       {'polar': False, 'charge': 'neutral',  'essential': False},
    'Histidine':     {'polar': True,  'charge': 'positive', 'essential': True},
    'Isoleucine':    {'polar': False, 'charge': 'neutral',  'essential': True},
    'Leucine':       {'polar': False, 'charge': 'neutral',  'essential': True},
    'Lysine':        {'polar': True,  'charge': 'positive', 'essential': True},
    'Methionine':    {'polar': False, 'charge': 'neutral',  'essential': True},
    'Phenylalanine': {'polar': False, 'charge': 'neutral',  'essential': True},
    'Proline':       {'polar': False, 'charge': 'neutral',  'essential': False},
    'Serine':        {'polar': True,  'charge': 'neutral',  'essential': False},
    'Threonine':     {'polar': True,  'charge': 'neutral',  'essential': True},
    'Tryptophan':    {'polar': False, 'charge': 'neutral',  'essential': True},
    'Tyrosine':      {'polar': True,  'charge': 'neutral',  'essential': False},
    'Valine':        {'polar': False, 'charge': 'neutral',  'essential': True},
}


# ── Sequence Analysis Logic ───────────────────────────────────────────────────

def clean_sequence(seq):
    """Remove whitespace, FASTA headers, numbers; uppercase."""
    lines = seq.strip().splitlines()
    cleaned = []
    for line in lines:
        if line.startswith('>'):
            continue
        cleaned.append(re.sub(r'[\s\d]', '', line).upper())
    return ''.join(cleaned)


def detect_sequence_type(seq):
    dna_bases = set('ACGT')
    rna_bases = set('ACGU')
    seq_set = set(seq)

    has_t = 'T' in seq_set
    has_u = 'U' in seq_set

    if has_t and has_u:
        return 'invalid', sorted(seq_set - (dna_bases | rna_bases)), \
               "The sequence contains both T (Thymine) and U (Uracil), which cannot coexist in a valid biological sequence."

    invalid_chars = sorted(seq_set - (dna_bases | rna_bases))
    if invalid_chars:
        return 'invalid', invalid_chars, \
               f"The sequence contains characters ({', '.join(invalid_chars)}) that are not valid nucleotide bases."

    if has_u and not has_t:
        return 'rna', [], "The sequence contains Uracil (U) but no Thymine (T), which is characteristic of RNA."

    # DNA (may contain only A, C, G with no T or U — treat as DNA)
    return 'dna', [], "The sequence contains only A, T, G, C bases (Adenine, Thymine, Guanine, Cytosine), which are the four bases of DNA."


def transcribe(seq, strand_type):
    """
    strand_type: 'non_template' (coding strand) or 'template'
    Returns mRNA string.
    """
    if strand_type == 'non_template':
        # Coding strand → mRNA: replace T with U
        mrna = seq.replace('T', 'U')
        explanation = (
            "You provided the non-template (coding/sense) strand. "
            "To produce mRNA, the cell simply replaces every Thymine (T) with Uracil (U). "
            "No complementing is needed because this strand already has the same sequence as the mRNA."
        )
    else:
        # Template strand → complement + replace T→U
        complement = {'A': 'U', 'T': 'A', 'G': 'C', 'C': 'G'}
        mrna = ''.join(complement.get(b, b) for b in seq)
        explanation = (
            "You provided the template (antisense) strand. "
            "The cell reads this strand from 3' to 5' and builds a complementary mRNA strand: "
            "A pairs with U, T pairs with A, C pairs with G, and G pairs with C. "
            "This produces a messenger RNA (mRNA) molecule."
        )
    return mrna, explanation


def transcribe_rna(seq):
    """RNA input is already mRNA."""
    return seq, "Your input is already an RNA sequence, so it serves directly as the mRNA. No transcription step is needed."


def translate(mrna):
    """Translate mRNA to list of codon dicts. Stops at stop codon."""
    codons = []
    start_found = False
    for i in range(0, len(mrna) - 2, 3):
        codon = mrna[i:i+3]
        if len(codon) < 3:
            break
        info = CODON_TABLE.get(codon)
        if info is None:
            codons.append({'codon': codon, 'name': 'Unknown', 'three': '???', 'one': '?', 'is_start': False, 'is_stop': False})
            continue
        name, three, one = info
        is_stop = (name == 'Stop')
        is_start = (codon == 'AUG' and not start_found)
        if is_start:
            start_found = True
        codons.append({'codon': codon, 'name': name, 'three': three, 'one': one,
                       'is_start': is_start, 'is_stop': is_stop})
        if is_stop:
            break
    return codons


def build_polypeptide(codons):
    """Return amino acids between start and stop (exclusive), or all if no start."""
    aa_list = []
    in_chain = False
    has_start = any(c['is_start'] for c in codons)

    for c in codons:
        if c['is_stop']:
            break
        if has_start:
            if c['is_start']:
                in_chain = True
            if in_chain:
                aa_list.append(c)
        else:
            if c['name'] != 'Stop':
                aa_list.append(c)
    return aa_list


def characterise_protein(aa_list):
    if not aa_list:
        return {}
    one_letter = ''.join(a['one'] for a in aa_list)
    counts = {}
    for a in aa_list:
        counts[a['name']] = counts.get(a['name'], 0) + 1

    polar = sum(1 for a in aa_list if AA_PROPERTIES.get(a['name'], {}).get('polar'))
    nonpolar = len(aa_list) - polar
    pos_charged = sum(1 for a in aa_list if AA_PROPERTIES.get(a['name'], {}).get('charge') == 'positive')
    neg_charged = sum(1 for a in aa_list if AA_PROPERTIES.get(a['name'], {}).get('charge') == 'negative')
    essential_count = sum(1 for a in aa_list if AA_PROPERTIES.get(a['name'], {}).get('essential'))

    # Approximate molecular weight (avg 110 Da per residue)
    mol_weight = len(aa_list) * 110

    return {
        'length': len(aa_list),
        'sequence': one_letter,
        'composition': counts,
        'polar': polar,
        'nonpolar': nonpolar,
        'positive_charged': pos_charged,
        'negative_charged': neg_charged,
        'essential_count': essential_count,
        'approx_mw': mol_weight,
    }


def query_uniprot(sequence):
    """Query UniProt BLAST API for the protein sequence."""
    try:
        # Use UniProt's programmatic search by sequence similarity via BLAST
        blast_url = "https://rest.uniprot.org/uniprotkb/search"
        # Search by sequence (using first 20 aa as query hint for demo)
        short_seq = sequence[:30] if len(sequence) > 30 else sequence

        params = urllib.parse.urlencode({
            'query': f'sequence:{short_seq}',
            'format': 'json',
            'size': 3,
            'fields': 'id,protein_name,organism_name,function,length'
        })
        url = f"{blast_url}?{params}"
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            results = []
            for entry in data.get('results', [])[:3]:
                pname = entry.get('proteinDescription', {})
                rec_name = pname.get('recommendedName', {}).get('fullName', {}).get('value', 'Unknown protein')
                org = entry.get('organism', {}).get('scientificName', 'Unknown organism')
                funcs = entry.get('comments', [])
                func_text = ''
                for c in funcs:
                    if c.get('commentType') == 'FUNCTION':
                        texts = c.get('texts', [])
                        if texts:
                            func_text = texts[0].get('value', '')[:200]
                            break
                results.append({
                    'id': entry.get('primaryAccession', ''),
                    'name': rec_name,
                    'organism': org,
                    'function': func_text or 'No functional annotation available.',
                    'length': entry.get('sequence', {}).get('length', 'N/A'),
                })
            return results, None
    except Exception as e:
        return [], str(e)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    raw_seq = data.get('sequence', '').strip()
    strand_type = data.get('strand_type', 'non_template')

    if not raw_seq:
        return jsonify({'error': 'No sequence provided.'}), 400

    seq = clean_sequence(raw_seq)
    if not seq:
        return jsonify({'error': 'Sequence is empty after cleaning.'}), 400

    # 1. Detection
    seq_type, invalid_chars, detection_explanation = detect_sequence_type(seq)

    if seq_type == 'invalid':
        return jsonify({
            'step': 'detection',
            'error': True,
            'seq_type': 'invalid',
            'invalid_chars': invalid_chars,
            'detection_explanation': detection_explanation,
            'sequence': seq,
        })

    result = {
        'error': False,
        'seq_type': seq_type,
        'sequence': seq,
        'detection_explanation': detection_explanation,
    }

    # 2. Transcription
    if seq_type == 'dna':
        mrna, transcription_explanation = transcribe(seq, strand_type)
        result['strand_type'] = strand_type
    else:
        mrna, transcription_explanation = transcribe_rna(seq)
        result['strand_type'] = 'rna_input'

    result['mrna'] = mrna
    result['transcription_explanation'] = transcription_explanation

    # 3. Translation
    codons = translate(mrna)
    result['codons'] = codons

    # 4. Polypeptide
    aa_list = build_polypeptide(codons)
    result['amino_acids'] = aa_list

    # 5. Protein characterisation
    protein = characterise_protein(aa_list)
    result['protein'] = protein

    return jsonify(result)


@app.route('/api/database_lookup', methods=['POST'])
def database_lookup():
    data = request.get_json()
    sequence = data.get('sequence', '')
    if not sequence:
        return jsonify({'error': 'No sequence provided.'}), 400

    results, err = query_uniprot(sequence)
    return jsonify({'results': results, 'error': err})


@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    content = f.read().decode('utf-8', errors='ignore')
    return jsonify({'sequence': content})


if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    app.run(debug=True, port=5000)
