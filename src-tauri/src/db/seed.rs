// Workman — db/seed.rs
// src-tauri/src/db/seed.rs
// Seeds the database with Bible text (KJV + RVR60),
// Strong's concordance, and curated illustrations on first launch.
// All data is bundled with the app — no internet required.
//
// Source JSON files live in public/data/ and are included
// at compile time via include_str!() macros.
// This means the data is baked into the binary itself.

use rusqlite::Connection;
use serde::Deserialize;
use std::collections::HashMap;
use crate::error::{AppError, Result};
use crate::db::{new_id, now};

// ─────────────────────────────────────────────
// BUNDLED DATA FILES
// These are embedded at compile time.
// Paths are relative to src-tauri/
// ─────────────────────────────────────────────

static KJV_JSON:              &str = include_str!("../../../public/data/kjv.json");
static RVR60_JSON:            &str = include_str!("../../../public/data/rvr60.json");
static STRONGS_GREEK_JSON:    &str = include_str!("../../../public/data/strongs-greek.json");
static STRONGS_HEBREW_JSON:   &str = include_str!("../../../public/data/strongs-hebrew.json");
static ILLUSTRATIONS_EN_JSON: &str = include_str!("../../../public/data/illustrations-en.json");
static ILLUSTRATIONS_ES_JSON: &str = include_str!("../../../public/data/illustrations-es.json");

// ─────────────────────────────────────────────
// TYPES for JSON deserialization
// ─────────────────────────────────────────────

// Bible JSON: { "Genesis": { "1": { "1": "In the beginning..." } } }
type BibleJson = HashMap<String, HashMap<String, HashMap<String, String>>>;

#[derive(Deserialize)]
struct StrongsEntry {
    lemma:       Option<String>,
    translit:    Option<String>,
    strongs_def: Option<String>,
    kjv_def:     Option<String>,
}

type StrongsJson = HashMap<String, StrongsEntry>;

#[derive(Deserialize)]
struct IllustrationJson {
    title:  String,
    body:   String,
    source: Option<String>,
    tags:   Vec<IllustrationTagJson>,
}

#[derive(Deserialize)]
struct IllustrationTagJson {
    tag:      String,
    category: Option<String>,
}

// ─────────────────────────────────────────────
// BOOK ORDER
// Maps book names to canonical 1-66 numbers
// ─────────────────────────────────────────────

fn book_order() -> HashMap<&'static str, i64> {
    [
        ("Genesis",1),("Exodus",2),("Leviticus",3),("Numbers",4),("Deuteronomy",5),
        ("Joshua",6),("Judges",7),("Ruth",8),("1 Samuel",9),("2 Samuel",10),
        ("1 Kings",11),("2 Kings",12),("1 Chronicles",13),("2 Chronicles",14),
        ("Ezra",15),("Nehemiah",16),("Esther",17),("Job",18),("Psalms",19),
        ("Proverbs",20),("Ecclesiastes",21),("Song of Solomon",22),("Isaiah",23),
        ("Jeremiah",24),("Lamentations",25),("Ezekiel",26),("Daniel",27),
        ("Hosea",28),("Joel",29),("Amos",30),("Obadiah",31),("Jonah",32),
        ("Micah",33),("Nahum",34),("Habakkuk",35),("Zephaniah",36),("Haggai",37),
        ("Zechariah",38),("Malachi",39),
        ("Matthew",40),("Mark",41),("Luke",42),("John",43),("Acts",44),
        ("Romans",45),("1 Corinthians",46),("2 Corinthians",47),("Galatians",48),
        ("Ephesians",49),("Philippians",50),("Colossians",51),("1 Thessalonians",52),
        ("2 Thessalonians",53),("1 Timothy",54),("2 Timothy",55),("Titus",56),
        ("Philemon",57),("Hebrews",58),("James",59),("1 Peter",60),("2 Peter",61),
        ("1 John",62),("2 John",63),("3 John",64),("Jude",65),("Revelation",66),
    ].iter().copied().collect()
}

// Spanish book name → canonical English name (for book_number lookup)
fn rvr60_book_map() -> HashMap<&'static str, &'static str> {
    [
        ("Génesis","Genesis"),("Éxodo","Exodus"),("Levítico","Leviticus"),
        ("Números","Numbers"),("Deuteronomio","Deuteronomy"),("Josué","Joshua"),
        ("Jueces","Judges"),("Rut","Ruth"),("1 Samuel","1 Samuel"),("2 Samuel","2 Samuel"),
        ("1 Reyes","1 Kings"),("2 Reyes","2 Kings"),("1 Crónicas","1 Chronicles"),
        ("2 Crónicas","2 Chronicles"),("Esdras","Ezra"),("Nehemías","Nehemiah"),
        ("Ester","Esther"),("Job","Job"),("Salmos","Psalms"),("Proverbios","Proverbs"),
        ("Eclesiastés","Ecclesiastes"),("Cantares","Song of Solomon"),("Isaías","Isaiah"),
        ("Jeremías","Jeremiah"),("Lamentaciones","Lamentations"),("Ezequiel","Ezekiel"),
        ("Daniel","Daniel"),("Oseas","Hosea"),("Joel","Joel"),("Amós","Amos"),
        ("Abdías","Obadiah"),("Jonás","Jonah"),("Miqueas","Micah"),("Nahúm","Nahum"),
        ("Habacuc","Habakkuk"),("Sofonías","Zephaniah"),("Hageo","Haggai"),
        ("Zacarías","Zechariah"),("Malaquías","Malachi"),("Mateo","Matthew"),
        ("Marcos","Mark"),("Lucas","Luke"),("Juan","John"),("Hechos","Acts"),
        ("Romanos","Romans"),("1 Corintios","1 Corinthians"),("2 Corintios","2 Corinthians"),
        ("Gálatas","Galatians"),("Efesios","Ephesians"),("Filipenses","Philippians"),
        ("Colosenses","Colossians"),("1 Tesalonicenses","1 Thessalonians"),
        ("2 Tesalonicenses","2 Thessalonians"),("1 Timoteo","1 Timothy"),
        ("2 Timoteo","2 Timothy"),("Tito","Titus"),("Filemón","Philemon"),
        ("Hebreos","Hebrews"),("Santiago","James"),("1 Pedro","1 Peter"),
        ("2 Pedro","2 Peter"),("1 Juan","1 John"),("2 Juan","2 John"),
        ("3 Juan","3 John"),("Judas","Jude"),("Apocalipsis","Revelation"),
    ].iter().copied().collect()
}

// ─────────────────────────────────────────────
// MAIN SEED FUNCTION
// Called once on first launch — no-op if data already exists
// ─────────────────────────────────────────────

pub fn seed_if_empty(conn: &Connection) -> Result<()> {
    let verse_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM bible_verses", [], |r| r.get(0))
        .unwrap_or(0);

    if verse_count > 0 {
        // Already seeded — skip
        return Ok(());
    }

    println!("First launch detected — seeding Bible data and lexicon…");

    seed_bible(conn, KJV_JSON, "KJV", None)?;
    seed_bible(conn, RVR60_JSON, "RVR60", Some(rvr60_book_map()))?;
    seed_strongs(conn, STRONGS_GREEK_JSON, "GREEK", "G")?;
    seed_strongs(conn, STRONGS_HEBREW_JSON, "HEBREW", "H")?;
    seed_illustrations(conn, ILLUSTRATIONS_EN_JSON, "EN")?;
    seed_illustrations(conn, ILLUSTRATIONS_ES_JSON, "ES")?;

    println!("Seeding complete.");
    Ok(())
}

// ─────────────────────────────────────────────
// BIBLE TEXT SEED
// ─────────────────────────────────────────────

fn seed_bible(
    conn:     &Connection,
    json_str: &str,
    translation: &str,
    book_map: Option<HashMap<&str, &str>>,
) -> Result<()> {
    println!("  Seeding {}…", translation);

    let data: BibleJson = serde_json::from_str(json_str)
        .map_err(|e| AppError::ParseError(e.to_string()))?;

    let orders = book_order();

    let tx = conn.unchecked_transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut stmt = tx.prepare(
        "INSERT OR IGNORE INTO bible_verses
         (id, translation, book, book_number, chapter, verse, text)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let mut count = 0u32;

    for (book_name, chapters) in &data {
        // Resolve canonical name for book_number lookup
        let canonical = if let Some(ref map) = book_map {
            map.get(book_name.as_str()).copied().unwrap_or(book_name.as_str())
        } else {
            book_name.as_str()
        };

        let book_number = orders.get(canonical).copied().unwrap_or(0);
        if book_number == 0 {
            eprintln!("    Unknown book: {} — skipping", book_name);
            continue;
        }

        for (chapter_str, verses) in chapters {
            let chapter: i64 = chapter_str.parse().unwrap_or(0);
            for (verse_str, text) in verses {
                let verse: i64 = verse_str.parse().unwrap_or(0);
                stmt.execute(rusqlite::params![
                    new_id(), translation, book_name, book_number, chapter, verse, text
                ]).map_err(|e| AppError::Database(e.to_string()))?;
                count += 1;
            }
        }
    }

    drop(stmt);
    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    println!("    {} verses inserted", count);
    Ok(())
}

// ─────────────────────────────────────────────
// STRONG'S CONCORDANCE SEED
// ─────────────────────────────────────────────

fn seed_strongs(
    conn:     &Connection,
    json_str: &str,
    language: &str,
    prefix:   &str,
) -> Result<()> {
    println!("  Seeding {} lexicon…", language);

    let data: std::collections::HashMap<String, StrongsEntry> =
        serde_json::from_str(json_str)
            .map_err(|e| AppError::ParseError(e.to_string()))?;

    let tx = conn.unchecked_transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut stmt = tx.prepare(
        "INSERT OR IGNORE INTO lexicon_words
         (id, strongs_number, language, original_word, transliteration,
          pronunciation, part_of_speech, glosses, definition)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let mut count = 0u32;

    for (key, entry) in &data {
        // Key is already the Strong's number e.g. "G1615"
        // Make sure it has the right prefix
        let strongs_number = if key.starts_with(prefix) {
            key.clone()
        } else {
            format!("{}{}", prefix, key)
        };

        let glosses = parse_glosses(entry.kjv_def.as_deref().unwrap_or(""));
        let glosses_json = serde_json::to_string(&glosses)
            .unwrap_or_else(|_| "[]".to_string());

        stmt.execute(rusqlite::params![
            crate::db::new_id(),
            strongs_number,
            language,
            entry.lemma.as_deref().unwrap_or(""),
            entry.translit.as_deref().unwrap_or(""),
            Option::<String>::None,
            Option::<String>::None,
            glosses_json,
            entry.strongs_def,
        ]).map_err(|e| AppError::Database(e.to_string()))?;

        count += 1;
    }

    drop(stmt);
    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    println!("    {} words inserted", count);
    Ok(())
}

fn parse_glosses(kjv_def: &str) -> Vec<String> {
    if kjv_def.is_empty() {
        return vec![];
    }
    kjv_def
        .split(|c| c == ';' || c == ',')
        .map(|g| {
            // Remove bracketed content safely using char indices
            let mut s = g.to_string();
            loop {
                if let Some(start) = s.find('[') {
                    if let Some(end) = s.find(']') {
                        if end > start {
                            s = format!("{}{}", &s[..start], &s[end+1..]);
                        } else {
                            break;
                        }
                    } else {
                        s = s[..start].to_string();
                        break;
                    }
                } else {
                    break;
                }
            }
            loop {
                if let Some(start) = s.find('(') {
                    if let Some(end) = s.find(')') {
                        if end > start {
                            s = format!("{}{}", &s[..start], &s[end+1..]);
                        } else {
                            break;
                        }
                    } else {
                        s = s[..start].to_string();
                        break;
                    }
                } else {
                    break;
                }
            }
            s.trim().to_lowercase()
        })
        .filter(|g| g.len() > 1)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect()
}

// ─────────────────────────────────────────────
// ILLUSTRATIONS SEED
// ─────────────────────────────────────────────

fn seed_illustrations(conn: &Connection, json_str: &str, language: &str) -> Result<()> {
    println!("  Seeding {} illustrations…", language);

    let illustrations: Vec<IllustrationJson> = serde_json::from_str(json_str)
        .map_err(|e| AppError::ParseError(e.to_string()))?;

    let tx = conn.unchecked_transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut ill_stmt = tx.prepare(
        "INSERT OR IGNORE INTO illustrations
         (id, title, body, source, language, is_custom, is_favorited, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6, ?7)"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let mut tag_stmt = tx.prepare(
        "INSERT OR IGNORE INTO illustration_tags (id, illustration_id, tag, category)
         VALUES (?1, ?2, ?3, ?4)"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    for ill in &illustrations {
        let ill_id = new_id();
        let ts = now();

        ill_stmt.execute(rusqlite::params![
            ill_id, ill.title, ill.body, ill.source, language, ts, ts
        ]).map_err(|e| AppError::Database(e.to_string()))?;

        for tag in &ill.tags {
            tag_stmt.execute(rusqlite::params![
                new_id(), ill_id, tag.tag, tag.category
            ]).map_err(|e| AppError::Database(e.to_string()))?;
        }
    }

     drop(ill_stmt);
    drop(tag_stmt);
    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    println!("    {} illustrations inserted", illustrations.len());
    Ok(())
}

