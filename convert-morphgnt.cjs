// convert-morphgnt.cjs
// Run from the workman root folder:
//   node convert-morphgnt.cjs "C:\Users\jonat\Downloads\sblgnt-master\sblgnt-master"

const fs   = require('fs')
const path = require('path')

const sourceDir = process.argv[2]

if (!sourceDir) {
  console.error('Usage: node convert-morphgnt.cjs <path-to-sblgnt-folder>')
  process.exit(1)
}

if (!fs.existsSync(sourceDir)) {
  console.error('Directory not found:', sourceDir)
  process.exit(1)
}

const BOOK_NAMES = {
  '01': 'Matthew',        '02': 'Mark',           '03': 'Luke',
  '04': 'John',           '05': 'Acts',            '06': 'Romans',
  '07': '1 Corinthians',  '08': '2 Corinthians',   '09': 'Galatians',
  '10': 'Ephesians',      '11': 'Philippians',     '12': 'Colossians',
  '13': '1 Thessalonians','14': '2 Thessalonians', '15': '1 Timothy',
  '16': '2 Timothy',      '17': 'Titus',           '18': 'Philemon',
  '19': 'Hebrews',        '20': 'James',           '21': '1 Peter',
  '22': '2 Peter',        '23': '1 John',          '24': '2 John',
  '25': '3 John',         '26': 'Jude',            '27': 'Revelation',
}

const POS_NAMES = {
  'A-': 'adjective',     'C-': 'conjunction',   'D-': 'adverb',
  'I-': 'interjection',  'N-': 'noun',           'P-': 'preposition',
  'RA': 'definite article','RD': 'demonstrative pronoun',
  'RI': 'interrogative pronoun','RP': 'personal pronoun',
  'RR': 'relative pronoun','V-': 'verb',          'X-': 'particle',
}

// Load Strong's Greek to build lemma -> strongs map
const strongsPath = path.join(__dirname, 'public', 'data', 'strongs-greek.json')
if (!fs.existsSync(strongsPath)) {
  console.error('strongs-greek.json not found.')
  process.exit(1)
}

console.log("Loading Strong's Greek dictionary...")
const strongsData = JSON.parse(fs.readFileSync(strongsPath, 'utf8'))

const lemmaToStrongs = {}
for (const [key, entry] of Object.entries(strongsData)) {
  if (entry.lemma) {
    const lemma = entry.lemma
      .replace(/[·,;\.·\[\]]/g, '')  // strip punctuation
      .trim()
    if (lemma && !lemmaToStrongs[lemma]) {
      lemmaToStrongs[lemma] = key
    }
  }
}
console.log(`  ${Object.keys(lemmaToStrongs).length} lemma mappings built`)

// Find all morphgnt files
const files = fs.readdirSync(sourceDir)
  .filter(f => f.endsWith('-morphgnt.txt'))
  .sort()

console.log(`\nProcessing ${files.length} NT books...`)

const byLocation = {}
let totalWords = 0
let matched = 0

for (const filename of files) {
  const filePath = path.join(sourceDir, filename)
  const content  = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r\n|\r|\n/)
console.log(`  Lines found: ${lines.length}, first line length: ${lines[0] ? lines[0].length : 0}`)
console.log(`  First line: ${lines[0] ? lines[0].substring(0, 50) : 'EMPTY'}`)
const testLine = lines[0] || ''
const testCols = testLine.split(' ')
console.log(`  First line cols: ${testCols.length}`)
console.log(`  Col 0: "${testCols[0]}", Col 1: "${testCols[1]}", Col 2: "${testCols[2]}"`)
  let bookWords = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // MorphGNT format: BBCCVV POS PARSING WORD NORMALIZED LEMMA
    // Fields are separated by single spaces
    // Some words start with text-critical markers like ⸀ ⸂ ⸃
    // We split by spaces and take positional columns
    const cols = line.split(' ')
    if (cols.length < 6) continue

    const bcv     = cols[0]  // e.g. "040101"
    const pos     = cols[1]  // e.g. "N-"
    const parsing = cols[2]  // e.g. "----NSM-"
    // cols[3] = word as in text (may have punctuation/markers)
    // cols[4] = normalized form  
    // cols[5] = lemma (dictionary form) — this is what we want

    // Get the lemma — it's the last column when there are exactly 6
    // but some lines have 7 columns (the 7th being a strongs lemma variant)
    const lemma = cols[5] ? cols[5].replace(/[·,;\.·\[\]⸀⸂⸃]/g, '').trim() : ''
    const word  = cols[3] ? cols[3].replace(/[·,;\.·\[\]⸀⸂⸃]/g, '').trim() : ''

    if (!bcv || bcv.length < 6) continue
    if (!lemma) continue

    const bookNum = bcv.substring(0, 2)
    const chapter = parseInt(bcv.substring(2, 4), 10)
    const verse   = parseInt(bcv.substring(4, 6), 10)

    if (isNaN(chapter) || isNaN(verse)) continue

    const book = BOOK_NAMES[bookNum]
    if (!book) continue

    // Find Strong's number
    let strongsNumber = lemmaToStrongs[lemma]

    // Try without accents if not found (rough fallback)
    if (!strongsNumber) {
      // Try the normalized form
      const normalized = cols[4] ? cols[4].replace(/[·,;\.·\[\]⸀⸂⸃]/g, '').trim() : ''
      if (normalized) strongsNumber = lemmaToStrongs[normalized]
    }

    const key = `${book}|${chapter}|${verse}`
    if (!byLocation[key]) byLocation[key] = []

    byLocation[key].push({
      word,
      lemma,
      strongs: strongsNumber || null,
      pos:     POS_NAMES[pos] || pos,
      parsing,
    })

    if (strongsNumber) matched++
    bookWords++
    totalWords++
  }

  console.log(`  ${filename}: ${bookWords} words`)
}

console.log(`\nTotal words: ${totalWords.toLocaleString()}`)
console.log(`Matched to Strong\'s: ${matched.toLocaleString()} (${Math.round(matched/totalWords*100)}%)`)
console.log(`Unique verse locations: ${Object.keys(byLocation).length.toLocaleString()}`)

const outputPath = path.join(__dirname, 'public', 'data', 'morphgnt-occurrences.json')
fs.writeFileSync(outputPath, JSON.stringify(byLocation, null, 0))

const sizeKB = Math.round(fs.statSync(outputPath).size / 1024)
console.log(`\nWrote: ${outputPath}`)
console.log(`Size: ${sizeKB} KB`)
