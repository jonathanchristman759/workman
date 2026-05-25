// convert-rvr60.cjs
// Run from the workman root folder:
//   node convert-rvr60.cjs
//
// Reads public/data/rvr60.json and converts it from the scrollmapper format:
// { "books": [ { "name": "Genesis", "chapters": [ { "chapter": 1, "verses": [ { "verse": 1, "text": "..." } ] } ] } ] }
//
// To the format our seed script expects:
// { "Genesis": { "1": { "1": "text", "2": "text" } } }

const fs   = require('fs')
const path = require('path')

const inputPath  = path.join(__dirname, 'public', 'data', 'rvr60.json')
const outputPath = path.join(__dirname, 'public', 'data', 'rvr60.json')

if (!fs.existsSync(inputPath)) {
  console.error('File not found:', inputPath)
  process.exit(1)
}

console.log('Reading rvr60.json...')
const raw  = fs.readFileSync(inputPath, 'utf8')
const data = JSON.parse(raw)

// Spanish book name map — scrollmapper uses English names for the Spanish Bible
// We store them under their Spanish names so the language toggle works correctly
const SPANISH_NAMES = {
  'Genesis':         'Génesis',
  'Exodus':          'Éxodo',
  'Leviticus':       'Levítico',
  'Numbers':         'Números',
  'Deuteronomy':     'Deuteronomio',
  'Joshua':          'Josué',
  'Judges':          'Jueces',
  'Ruth':            'Rut',
  '1 Samuel':        '1 Samuel',
  '2 Samuel':        '2 Samuel',
  '1 Kings':         '1 Reyes',
  '2 Kings':         '2 Reyes',
  '1 Chronicles':    '1 Crónicas',
  '2 Chronicles':    '2 Crónicas',
  'Ezra':            'Esdras',
  'Nehemiah':        'Nehemías',
  'Esther':          'Ester',
  'Job':             'Job',
  'Psalms':          'Salmos',
  'Proverbs':        'Proverbios',
  'Ecclesiastes':    'Eclesiastés',
  'Song of Solomon': 'Cantares',
  'Isaiah':          'Isaías',
  'Jeremiah':        'Jeremías',
  'Lamentations':    'Lamentaciones',
  'Ezekiel':         'Ezequiel',
  'Daniel':          'Daniel',
  'Hosea':           'Oseas',
  'Joel':            'Joel',
  'Amos':            'Amós',
  'Obadiah':         'Abdías',
  'Jonah':           'Jonás',
  'Micah':           'Miqueas',
  'Nahum':           'Nahúm',
  'Habakkuk':        'Habacuc',
  'Zephaniah':       'Sofonías',
  'Haggai':          'Hageo',
  'Zechariah':       'Zacarías',
  'Malachi':         'Malaquías',
  'Matthew':         'Mateo',
  'Mark':            'Marcos',
  'Luke':            'Lucas',
  'John':            'Juan',
  'Acts':            'Hechos',
  'Romans':          'Romanos',
  '1 Corinthians':   '1 Corintios',
  '2 Corinthians':   '2 Corintios',
  'Galatians':       'Gálatas',
  'Ephesians':       'Efesios',
  'Philippians':     'Filipenses',
  'Colossians':      'Colosenses',
  '1 Thessalonians': '1 Tesalonicenses',
  '2 Thessalonians': '2 Tesalonicenses',
  '1 Timothy':       '1 Timoteo',
  '2 Timothy':       '2 Timoteo',
  'Titus':           'Tito',
  'Philemon':        'Filemón',
  'Hebrews':         'Hebreos',
  'James':           'Santiago',
  '1 Peter':         '1 Pedro',
  '2 Peter':         '2 Pedro',
  '1 John':          '1 Juan',
  '2 John':          '2 Juan',
  '3 John':          '3 Juan',
  'Jude':            'Judas',
  'Revelation':      'Apocalipsis',
  // Roman numeral variants
  'I Samuel':        '1 Samuel',
  'II Samuel':       '2 Samuel',
  'I Kings':         '1 Reyes',
  'II Kings':        '2 Reyes',
  'I Chronicles':    '1 Crónicas',
  'II Chronicles':   '2 Crónicas',
  'I Corinthians':   '1 Corintios',
  'II Corinthians':  '2 Corintios',
  'I Thessalonians': '1 Tesalonicenses',
  'II Thessalonians':'2 Tesalonicenses',
  'I Timothy':       '1 Timoteo',
  'II Timothy':      '2 Timoteo',
  'I Peter':         '1 Pedro',
  'II Peter':        '2 Pedro',
  'I John':          '1 Juan',
  'II John':         '2 Juan',
  'III John':        '3 Juan',
  'Revelation of John': 'Apocalipsis',
}

const combined = {}
let bookCount   = 0
let verseCount  = 0

for (const book of data.books) {
  const englishName  = book.name
  const spanishName  = SPANISH_NAMES[englishName] ?? englishName

  const bookData = {}

  for (const chapterObj of book.chapters) {
    const chapterNum = String(chapterObj.chapter)
    bookData[chapterNum] = {}

    for (const verseObj of chapterObj.verses) {
      const verseNum = String(verseObj.verse)
      // Clean up trailing whitespace that the source file sometimes includes
      bookData[chapterNum][verseNum] = verseObj.text.trim()
      verseCount++
    }
  }

  combined[spanishName] = bookData
  bookCount++
  process.stdout.write(`\r  Processed ${bookCount} books...`)
}

console.log(`\n\nConverted ${bookCount} books, ${verseCount.toLocaleString()} verses.`)

// Overwrite the file with the converted format
fs.writeFileSync(outputPath, JSON.stringify(combined, null, 0))

const sizeKB = Math.round(fs.statSync(outputPath).size / 1024)
console.log(`Wrote: ${outputPath}`)
console.log(`Size: ${sizeKB} KB`)
console.log(`Books: ${bookCount}/66`)
