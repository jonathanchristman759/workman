// Workman — services/parser.rs
// src-tauri/src/services/parser.rs
// Extracts plain text from sermon files for the import flow.
// Supports: .docx, .pdf, .txt, .rtf, .pages, .zip (bulk)
//
// .pages files are ZIP archives containing a file called
// 'Index/Document.iwa' (a protobuf). Extracting meaningful text
// from them without the Pages SDK is limited — we fall back to
// extracting any readable UTF-8 strings from the archive.

use std::fs;
use std::io::Read;
use crate::error::{AppError, Result};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

pub struct ParsedFile {
    pub text:              String,
    pub detected_title:    Option<String>,
    pub detected_passage:  Option<String>,
    pub detected_date:     Option<String>,
    pub word_count:        usize,
}

// ─────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────

pub fn parse_file(path: &str, ext: &str) -> Result<ParsedFile> {
    let text = match ext {
        "docx"  => parse_docx(path)?,
        "pdf"   => parse_pdf(path)?,
        "txt"   => parse_txt(path)?,
        "rtf"   => parse_rtf(path)?,
        "pages" => parse_pages(path)?,
        "zip"   => return Err(AppError::ParseError(
            "ZIP files should be extracted before parsing individual files".into()
        )),
        other   => return Err(AppError::ParseError(
            format!("Unsupported file format: .{}", other)
        )),
    };

    let cleaned = clean_text(&text);
    let word_count = cleaned.split_whitespace().count();

    Ok(ParsedFile {
        detected_title:   detect_title(&cleaned, path),
        detected_passage: detect_passage(&cleaned),
        detected_date:    detect_date(&cleaned),
        word_count,
        text: cleaned,
    })
}

// ─────────────────────────────────────────────
// FORMAT PARSERS
// ─────────────────────────────────────────────

fn parse_docx(path: &str) -> Result<String> {
    let bytes = fs::read(path)?;

    // docx-rs extracts text from the document.xml inside the ZIP
    let docx = docx_rs::read_docx(&bytes)
        .map_err(|e| AppError::ParseError(format!("docx parse error: {:?}", e)))?;

    let mut text = String::new();
    for child in docx.document.children {
        if let docx_rs::DocumentChild::Paragraph(para) = child {
            for run_child in para.children {
                if let docx_rs::ParagraphChild::Run(run) = run_child {
                    for run_content in run.children {
                        if let docx_rs::RunChild::Text(t) = run_content {
                            text.push_str(&t.text);
                            text.push(' ');
                        }
                    }
                }
            }
            text.push('\n');
        }
    }

    Ok(text)
}

fn parse_pdf(path: &str) -> Result<String> {
    let bytes = fs::read(path)?;
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| AppError::ParseError(format!("PDF parse error: {}", e)))?;
    Ok(text)
}

fn parse_txt(path: &str) -> Result<String> {
    let text = fs::read_to_string(path)
        .map_err(|e| AppError::Io(format!("Could not read file: {}", e)))?;
    Ok(text)
}

fn parse_rtf(path: &str) -> Result<String> {
    // RTF is a complex format — we do a best-effort extraction by
    // stripping RTF control words and keeping visible text.
    let raw = fs::read_to_string(path)
        .map_err(|e| AppError::Io(e.to_string()))?;

    let mut output = String::new();
    let mut in_control = false;
    let mut skip_group = 0i32;

    for ch in raw.chars() {
        match ch {
            '{'  => { skip_group += 1; }
            '}'  => { if skip_group > 0 { skip_group -= 1; } }
            '\\' => { in_control = true; }
            ' ' | '\n' if in_control => { in_control = false; }
            _ if in_control => {
                // Skip control word characters
                if !ch.is_alphanumeric() && ch != '-' {
                    in_control = false;
                    if ch == ';' { continue; }
                }
            }
            _ if skip_group == 0 => {
                output.push(ch);
            }
            _ => {}
        }
    }

    Ok(output)
}

fn parse_pages(path: &str) -> Result<String> {
    // .pages files are ZIP archives. The actual content is in a
    // protobuf binary (Index/Document.iwa) which requires the
    // Pages SDK to decode properly.
    // As a best-effort fallback, we scan the ZIP for any UTF-8
    // readable text content.

    let bytes = fs::read(path)?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| AppError::ParseError(format!("Could not open .pages file: {}", e)))?;

    let mut collected = String::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| AppError::ParseError(e.to_string()))?;

        // Only look at files that might contain text
        let name = file.name().to_string();
        if name.ends_with(".xml") || name.ends_with(".txt") || name.contains("Preview") {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_ok() {
                // Strip XML tags if present
                let stripped = strip_xml_tags(&content);
                if !stripped.trim().is_empty() {
                    collected.push_str(&stripped);
                    collected.push('\n');
                }
            }
        }
    }

    if collected.trim().is_empty() {
        // Warn the pastor — .pages extraction is limited without Pages app
        Ok("[Note: Text extraction from .pages files is limited. \
            Please export your Pages document as .docx or .txt for better results.]".to_string())
    } else {
        Ok(collected)
    }
}

// ─────────────────────────────────────────────
// ZIP BULK IMPORT
// Returns (filename, ParsedFile) pairs for all supported files
// ─────────────────────────────────────────────

pub fn parse_zip(path: &str) -> Result<Vec<(String, Result<ParsedFile>)>> {
    let bytes = fs::read(path)?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| AppError::ParseError(format!("Could not open ZIP: {}", e)))?;

    let mut results = Vec::new();
    let supported = ["docx", "pdf", "txt", "rtf", "pages"];

    // Collect files first to avoid borrow issues
    let mut entries: Vec<(String, Vec<u8>)> = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| AppError::ParseError(e.to_string()))?;

        if file.is_dir() { continue; }

        let filename = file.name().to_string();
        let ext = std::path::Path::new(&filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !supported.contains(&ext.as_str()) { continue; }
        if filename.starts_with('.') { continue; } // skip hidden files

        let mut buf = Vec::new();
        if file.read_to_end(&mut buf).is_ok() {
            entries.push((filename, buf));
        }
    }

    // Write to temp files and parse
    for (filename, buf) in entries {
        let ext = std::path::Path::new(&filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("txt")
            .to_lowercase();

        let tmp_path = std::env::temp_dir().join(format!("workman_import_{}", filename));
        match fs::write(&tmp_path, &buf) {
            Ok(_) => {
                let result = parse_file(tmp_path.to_str().unwrap_or(""), &ext);
                let _ = fs::remove_file(&tmp_path);
                results.push((filename, result));
            }
            Err(e) => {
                results.push((filename, Err(AppError::Io(e.to_string()))));
            }
        }
    }

    Ok(results)
}

// ─────────────────────────────────────────────
// TEXT HELPERS
// ─────────────────────────────────────────────

fn clean_text(text: &str) -> String {
    // Collapse multiple whitespace, normalize line endings
    text.lines()
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join("\n")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn strip_xml_tags(input: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => { in_tag = true; }
            '>' => { in_tag = false; out.push(' '); }
            _   => { if !in_tag { out.push(ch); } }
        }
    }
    out
}

// Bible book names for passage detection
const BIBLE_BOOKS: &[&str] = &[
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges",
    "Ruth","Samuel","Kings","Chronicles","Ezra","Nehemiah","Esther","Job",
    "Psalm","Psalms","Proverbs","Ecclesiastes","Isaiah","Jeremiah",
    "Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah",
    "Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah",
    "Malachi","Matthew","Mark","Luke","John","Acts","Romans","Corinthians",
    "Galatians","Ephesians","Philippians","Colossians","Thessalonians",
    "Timothy","Titus","Philemon","Hebrews","James","Peter","Revelation",
    // Spanish
    "Génesis","Éxodo","Salmos","Proverbios","Isaías","Mateo","Marcos",
    "Lucas","Juan","Hechos","Romanos","Apocalipsis",
];

fn detect_passage(text: &str) -> Option<String> {
    // Look for "Book Chapter:verse" patterns in the first 500 chars
    let snippet = &text[..text.len().min(500)];
    for book in BIBLE_BOOKS {
        if let Some(pos) = snippet.find(book) {
            let rest = &snippet[pos + book.len()..];
            // Grab up to 15 chars after the book name for chapter:verse
            let tail: String = rest.chars().take(15).collect();
            let ref_part = tail.trim_start();
            if ref_part.starts_with(|c: char| c.is_ascii_digit()) {
                let end = ref_part.find(|c: char| !c.is_ascii_digit() && c != ':' && c != '-' && c != '–')
                    .unwrap_or(ref_part.len());
                return Some(format!("{} {}", book, &ref_part[..end]));
            }
        }
    }
    None
}

fn detect_date(text: &str) -> Option<String> {
    // Look for common date patterns in the first 300 chars
    let snippet = &text[..text.len().min(300)];
    // Match MM/DD/YYYY or YYYY-MM-DD or "January 1, 2024"
    let date_patterns = [
        r"\d{1,2}/\d{1,2}/\d{2,4}",
        r"\d{4}-\d{2}-\d{2}",
    ];
    for pattern in &date_patterns {
        if let Some(m) = regex_find(snippet, pattern) {
            return Some(m);
        }
    }
    None
}

fn detect_title(text: &str, filename: &str) -> Option<String> {
    // Try the first non-empty line as the title
    if let Some(first_line) = text.lines().find(|l| !l.trim().is_empty()) {
        let trimmed = first_line.trim();
        if trimmed.len() > 3 && trimmed.len() < 200 {
            return Some(trimmed.to_string());
        }
    }
    // Fall back to filename without extension
    let stem = std::path::Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    Some(stem.replace(['-', '_'], " ").trim().to_string())
}

// Minimal regex-like finder for simple date patterns (no regex crate dependency)
fn regex_find(text: &str, pattern: &str) -> Option<String> {
    // Only handles the two specific patterns above
    match pattern {
        r"\d{1,2}/\d{1,2}/\d{2,4}" => {
            let chars: Vec<char> = text.chars().collect();
            for i in 0..chars.len() {
                if chars[i].is_ascii_digit() {
                    let mut j = i;
                    while j < chars.len() && chars[j].is_ascii_digit() { j += 1; }
                    if j < chars.len() && chars[j] == '/' {
                        let k = j + 1;
                        let mut l = k;
                        while l < chars.len() && chars[l].is_ascii_digit() { l += 1; }
                        if l < chars.len() && chars[l] == '/' {
                            let m = l + 1;
                            let mut n = m;
                            while n < chars.len() && chars[n].is_ascii_digit() { n += 1; }
                            if n - m >= 2 {
                                return Some(chars[i..n].iter().collect());
                            }
                        }
                    }
                }
            }
            None
        }
        r"\d{4}-\d{2}-\d{2}" => {
            let bytes = text.as_bytes();
            for i in 0..bytes.len().saturating_sub(9) {
                if bytes[i..i+4].iter().all(|b| b.is_ascii_digit())
                    && bytes[i+4] == b'-'
                    && bytes[i+5..i+7].iter().all(|b| b.is_ascii_digit())
                    && bytes[i+7] == b'-'
                    && bytes[i+8..i+10].iter().all(|b| b.is_ascii_digit())
                {
                    return Some(String::from_utf8_lossy(&bytes[i..i+10]).to_string());
                }
            }
            None
        }
        _ => None,
    }
}
