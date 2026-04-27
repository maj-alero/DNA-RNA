# DNA & RNA Sequence Analyzer
### CSC 442 — Computational Biology & Interdisciplinary Studies · Project 2

A full-stack web application that analyses DNA and RNA sequences and walks the user through the fundamental processes of molecular biology — from raw nucleotide input to a characterised protein with real-world database lookup.

---

## Features

| Step | Feature |
|------|---------|
| **Input** | Type/paste, file upload (.txt / .fasta), drag & drop |
| **Detection** | Auto-detects DNA vs RNA; flags invalid sequences with plain-English explanation |
| **Transcription** | Handles non-template (coding) and template strands; produces mRNA with explanation |
| **Translation** | Reads codons, highlights start/stop codons, shows each codon → amino acid |
| **Polypeptide** | Displays full amino acid chain with 1-letter, 3-letter, and full name |
| **Protein** | Composition stats, molecular weight estimate, amino acid bar chart |
| **Database Lookup** | Queries UniProt programmatically and displays protein name, organism, function |

---

## Project Structure

```
dna_analyzer/
├── app.py                  # Flask backend — all biology logic + API routes
├── requirements.txt
├── templates/
│   └── index.html          # Single-page HTML frontend
└── static/
    ├── css/style.css       # Dark-theme responsive stylesheet
    └── js/main.js          # Vanilla JS — UI interactions, fetch, rendering
```

---

## Setup & Run

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the development server
python app.py

# 3. Open in browser
http://localhost:5000
```

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Serves the main UI |
| POST | `/api/analyze` | Full pipeline: detect → transcribe → translate → characterise |
| POST | `/api/database_lookup` | Queries UniProt for matching proteins |
| POST | `/api/upload` | Parses uploaded sequence file content |

### POST `/api/analyze`
**Request body:**
```json
{ "sequence": "ATGGCCATTGTAATGGGCCGC...", "strand_type": "non_template" }
```
`strand_type` options: `"non_template"` (coding strand) | `"template"` (antisense strand)

**Response:** Full JSON object with all pipeline results.

---

## Sample Sequences

**DNA (non-template):**
```
ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG
```

**RNA:**
```
AUGGCCAUUGUAAUGGGCCGCUGAAAGGGU
```

**FASTA format also supported:**
```
>My_Sequence
ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG
```

---

## Biology Notes

- **Non-template strand** (coding/sense strand): same sequence as the mRNA (T→U substitution only)
- **Template strand** (antisense strand): complement is taken, then T→U
- **Translation** begins at the first **AUG** start codon and stops at **UAA**, **UAG**, or **UGA**
- If no start codon is present, all codons are translated (educational mode)
- The UniProt lookup searches by sequence keyword; for production use, integrate the full BLAST API

---

*End of README*
