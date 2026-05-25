// combine-kjv.js
// Run this from the workman root folder:
//   node combine-kjv.js <path-to-extracted-bible-kjv-folder>
//
// Example:
//   node combine-kjv.js C:\Users\YourName\Downloads\Bible-kjv-master
//
// This produces public/data/kjv.json in the format our seed script expects:
// { "Genesis": { "1": { "1": "In the beginning...", "2": "..." } } }

const fs   = require('fs')
const path = require('path')

const sourceDir = process.argv[2]

if (!sourceDir) {
  console.error('Usage: node combine-kjv.js <path-to-bible-kjv-folder>')
  process.exit(1)
}

if (!fs.existsSync(sourceDir)) {
  console.error('Directory not found:', sourceDir)
  process.exit(1)
}

// Canonical 66-book list in order
const BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges',
  'Ruth','1Samuel','2Samuel','1Kings','2Kings','1Chronicles','2Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes',
  'SongofSolomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John',
  'Acts','Romans','1Corinthians','2Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1Thessalonians','2Thessalonians','1Timothy',
  '2Timothy','Titus','Philemon','Hebrews','James','1Peter','2Peter',
  '1John','2John','3John','Jude','Revelation'
]

// Display names (what gets stored as the book key)
const DISPLAY_NAMES = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges',
  'Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes',
  'Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John',
  'Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy',
  '2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation'
]

const combined = {}
let found = 0
let missing = []

for (let i = 0; i < BOOKS.length; i++) {
  const filename = BOOKS[i]
  const displayName = DISPLAY_NAMES[i]

  // Try a few filename variations
  const variations = [
    filename + '.json',
    displayName + '.json',
    displayName.replace(/ /g, '') + '.json',
  ]

  let filePath = null
  for (const v of variations) {
    const candidate = path.join(sourceDir, v)
    if (fs.existsSync(candidate)) {
      filePath = candidate
      break
    }
  }

  if (!filePath) {
    missing.push(displayName)
    continue
  }

  try {
    const raw  = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)

    // The aruljohn format is: { "chapter": N, "verses": [ { "verse": N, "text": "..." } ] }
    // We need: { "1": { "1": "text", "2": "text" } }
    const bookData = {}

    const chapters = data.chapters || data
    const chapterArray = Array.isArray(chapters) ? chapters : Object.values(chapters)

    chapterArray.forEach((chapterObj, chapterIdx) => {
      const chapterNum = String(chapterObj.chapter || chapterIdx + 1)
      bookData[chapterNum] = {}

      const verses = chapterObj.verses || []
      verses.forEach((verseObj) => {
        const verseNum  = String(verseObj.verse)
        bookData[chapterNum][verseNum] = verseObj.text
      })
    })

    combined[displayName] = bookData
    found++
    process.stdout.write(`\r  Processed ${found} books...`)
  } catch (err) {
    console.error(`\nError reading ${filePath}:`, err.message)
    missing.push(displayName)
  }
}

console.log(`\n\nProcessed ${found} books.`)

if (missing.length > 0) {
  console.warn('Missing books:', missing.join(', '))
}

// Write the combined file
const outputPath = path.join(__dirname, 'public', 'data', 'kjv.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(combined, null, 0))

const sizeKB = Math.round(fs.statSync(outputPath).size / 1024)
console.log(`\nWrote: ${outputPath}`)
console.log(`Size: ${sizeKB} KB`)
console.log(`Books: ${Object.keys(combined).length}/66`)