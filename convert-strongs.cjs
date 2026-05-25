// convert-strongs.cjs
// Run from the workman root folder:
//   node convert-strongs.cjs "C:\Users\jonat\Downloads\strongs-master\strongs-master"

const fs   = require('fs')
const path = require('path')

const sourceDir = process.argv[2]

if (!sourceDir) {
  console.error('Usage: node convert-strongs.cjs <path-to-strongs-folder>')
  process.exit(1)
}

if (!fs.existsSync(sourceDir)) {
  console.error('Directory not found:', sourceDir)
  process.exit(1)
}

function convertFile(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error('File not found:', inputPath)
    return false
  }

  console.log(`Reading ${path.basename(inputPath)}...`)
  let content = fs.readFileSync(inputPath, 'utf8')

  // Find the first { which is where the actual data object starts
  const firstBrace = content.indexOf('{')
  if (firstBrace === -1) {
    console.error('Could not find opening brace in file')
    return false
  }

  // Find the last } which is where the data object ends
  const lastBrace = content.lastIndexOf('}')
  if (lastBrace === -1) {
    console.error('Could not find closing brace in file')
    return false
  }

  // Extract just the object between the first { and last }
  const jsonString = content.substring(firstBrace, lastBrace + 1)

  // Try to parse it
  let data
  try {
    data = JSON.parse(jsonString)
  } catch (err) {
    console.error('JSON parse error:', err.message)
    console.error('First 200 chars of extracted string:')
    console.error(jsonString.substring(0, 200))
    return false
  }

  const entryCount = Object.keys(data).length
  console.log(`  ${entryCount} entries found`)

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 0))
  const sizeKB = Math.round(fs.statSync(outputPath).size / 1024)
  console.log(`  Wrote: ${outputPath} (${sizeKB} KB)`)
  return true
}

const outputDir = path.join(__dirname, 'public', 'data')
fs.mkdirSync(outputDir, { recursive: true })

const greekInput  = path.join(sourceDir, 'greek',  'strongs-greek-dictionary.js')
const hebrewInput = path.join(sourceDir, 'hebrew', 'strongs-hebrew-dictionary.js')

const greekOk  = convertFile(greekInput,  path.join(outputDir, 'strongs-greek.json'))
const hebrewOk = convertFile(hebrewInput, path.join(outputDir, 'strongs-hebrew.json'))

console.log('\nDone.')
if (greekOk && hebrewOk) {
  console.log('Both Greek and Hebrew files converted successfully.')
} else {
  console.log('Some files failed — check errors above.')
}
