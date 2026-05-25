// Workman — services/pdf.rs
// src-tauri/src/services/pdf.rs
 
use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use crate::commands::sermons::Sermon;
use crate::error::{AppError, Result};
 
const PAGE_WIDTH_MM:  f32 = 215.9;
const PAGE_HEIGHT_MM: f32 = 279.4;
const MARGIN_MM:      f32 = 20.0;
 
const SIZE_TITLE:   f32 = 20.0;
const SIZE_PASSAGE: f32 = 13.0;
const SIZE_META:    f32 = 10.0;
const SIZE_HEADING: f32 = 13.0;
const SIZE_BODY:    f32 = 11.0;
const SIZE_FOOTER:  f32 = 8.0;
 
#[derive(serde::Deserialize)]
struct OutlinePoint {
    text:      String,
    subpoints: Option<Vec<String>>,
    #[serde(rename = "verseRef")]
    verse_ref: Option<String>,
}
 
#[derive(serde::Deserialize)]
struct OutlineJson {
    points: Vec<OutlinePoint>,
}
 
struct PageWriter<'a> {
    doc:           &'a PdfDocumentReference,
    font_regular:  IndirectFontRef,
    font_bold:     IndirectFontRef,
    font_italic:   IndirectFontRef,
    current_layer: PdfLayerReference,
    cursor_y:      f32,
    page_num:      usize,
}
 
impl<'a> PageWriter<'a> {
    fn new(
        doc:          &'a PdfDocumentReference,
        font_regular: IndirectFontRef,
        font_bold:    IndirectFontRef,
        font_italic:  IndirectFontRef,
        first_layer:  PdfLayerReference,
    ) -> Self {
        PageWriter {
            doc,
            font_regular,
            font_bold,
            font_italic,
            current_layer: first_layer,
            cursor_y: PAGE_HEIGHT_MM - MARGIN_MM,
            page_num: 1,
        }
    }
 
    fn new_page(&mut self) {
        self.page_num += 1;
        let (page, layer) = self.doc.add_page(
            Mm(PAGE_WIDTH_MM),
            Mm(PAGE_HEIGHT_MM),
            format!("Page {}", self.page_num),
        );
        self.current_layer = self.doc.get_page(page).get_layer(layer);
        self.cursor_y = PAGE_HEIGHT_MM - MARGIN_MM;
    }
 
    fn check_space(&mut self, needed_mm: f32) {
        if self.cursor_y - needed_mm < MARGIN_MM + 10.0 {
            self.new_page();
        }
    }
 
    fn write_line(
        &mut self,
        text:     &str,
        font:     &IndirectFontRef,
        size:     f32,
        x_offset: f32,
        line_gap: f32,
    ) {
        let line_height = size * 0.35 + 1.0;
        self.check_space(line_height + line_gap);
 
        self.current_layer.use_text(
            text,
            size,
            Mm(MARGIN_MM + x_offset),
            Mm(self.cursor_y),
            font,
        );
        self.cursor_y -= line_height + line_gap;
    }
 
    fn write_rule(&mut self, color: (f32, f32, f32)) {
        self.check_space(3.0);
        let (r, g, b) = color;
        self.current_layer.set_outline_color(Color::Rgb(Rgb::new(r, g, b, None)));
        self.current_layer.set_outline_thickness(0.5);
        self.current_layer.add_line(Line {
            points: vec![
                (Point::new(Mm(MARGIN_MM), Mm(self.cursor_y)), false),
                (Point::new(Mm(PAGE_WIDTH_MM - MARGIN_MM), Mm(self.cursor_y)), false),
            ],
            is_closed: false,
        });
        self.cursor_y -= 3.0;
    }
 
    fn blank(&mut self, mm: f32) {
        self.cursor_y -= mm;
    }
 
    fn write_footer(&mut self, pastor_name: &str) {
        let footer_y = MARGIN_MM + 5.0;
        self.current_layer.use_text(
            &format!("theworkman.app  ·  {}", pastor_name),
            SIZE_FOOTER,
            Mm(MARGIN_MM),
            Mm(footer_y),
            &self.font_regular.clone(),
        );
    }
}
 
pub fn export_sermon(
    sermon:      &Sermon,
    pastor_name: &str,
    church:      Option<&str>,
    output_path: &str,
) -> Result<()> {
    let doc_title = format!("{} — {}", sermon.title, sermon.passage_ref);
 
    let (doc, page1, layer1) = PdfDocument::new(
        &doc_title,
        Mm(PAGE_WIDTH_MM),
        Mm(PAGE_HEIGHT_MM),
        "Page 1",
    );
 
    let font_regular = doc.add_builtin_font(BuiltinFont::TimesRoman)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    let font_bold = doc.add_builtin_font(BuiltinFont::TimesBold)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    let font_italic = doc.add_builtin_font(BuiltinFont::TimesItalic)
        .map_err(|e| AppError::FileError(e.to_string()))?;
 
    let first_layer = doc.get_page(page1).get_layer(layer1);
    let mut writer = PageWriter::new(
        &doc,
        font_regular.clone(),
        font_bold.clone(),
        font_italic.clone(),
        first_layer,
    );
 
    // Header
    if let Some(ch) = church {
        let header_str = format!("{}  ·  {}", ch, pastor_name);
        writer.write_line(&header_str, &font_regular, SIZE_META, 0.0, 1.5);
    } else if !pastor_name.is_empty() {
        writer.write_line(pastor_name, &font_regular, SIZE_META, 0.0, 1.5);
    }
 
    writer.blank(2.0);
    writer.write_line(&sermon.title, &font_bold, SIZE_TITLE, 0.0, 2.0);
 
    let passage_line = format!("{} · King James Version", sermon.passage_ref);
    writer.write_line(&passage_line, &font_italic, SIZE_PASSAGE, 0.0, 1.5);
 
    let mut meta_parts = Vec::new();
    if let Some(ref date) = sermon.delivery_date {
        meta_parts.push(format_date(date));
    }
    if sermon.word_count > 0 {
        meta_parts.push(format!(
            "~{} words · ~{} min",
            sermon.word_count,
            (sermon.word_count as f32 / 130.0).round() as i64
        ));
    }
    if let Some(ref series) = sermon.series_title {
        meta_parts.push(format!("Series: {}", series));
    }
    if !meta_parts.is_empty() {
        writer.write_line(&meta_parts.join("  ·  "), &font_regular, SIZE_META, 0.0, 1.5);
    }
 
    writer.blank(2.0);
    writer.write_rule((0.788, 0.663, 0.431));
    writer.blank(4.0);
 
    // Content
    match sermon.mode.as_str() {
        "OUTLINE" => {
            if let Some(ref json_str) = sermon.outline_json {
                render_outline(&mut writer, json_str, &font_bold.clone(), &font_regular.clone())?;
            }
        }
        "MANUSCRIPT" => {
            if let Some(ref text) = sermon.manuscript {
                render_manuscript(&mut writer, text, &font_regular.clone())?;
            }
        }
        "NOTES" => {
            if let Some(ref text) = sermon.notes {
                render_notes(&mut writer, text, &font_regular.clone())?;
            }
        }
        _ => {
            writer.write_line("No content available.", &font_italic, SIZE_BODY, 0.0, 2.0);
        }
    }
 
    let footer_name = if church.is_some() {
        format!("{} · {}", pastor_name, church.unwrap_or(""))
    } else {
        pastor_name.to_string()
    };
    writer.write_footer(&footer_name);
 
    let file = File::create(output_path)
        .map_err(|e| AppError::FileError(format!("Could not create PDF: {}", e)))?;
 
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| AppError::FileError(format!("Could not write PDF: {}", e)))?;
 
    Ok(())
}
 
const ROMAN: &[&str] = &["I","II","III","IV","V","VI","VII","VIII","IX","X"];
const ALPHA:  &[&str] = &["a","b","c","d","e","f","g","h","i","j"];
 
fn render_outline(
    writer:       &mut PageWriter,
    json_str:     &str,
    font_bold:    &IndirectFontRef,
    font_regular: &IndirectFontRef,
) -> Result<()> {
    let outline: OutlineJson = serde_json::from_str(json_str)
        .map_err(|e| AppError::ParseError(format!("Outline parse error: {}", e)))?;
 
    for (i, point) in outline.points.iter().enumerate() {
        let numeral = ROMAN.get(i).copied().unwrap_or("•");
        let verse   = point.verse_ref.as_deref().unwrap_or("");
        let heading = if verse.is_empty() {
            format!("{}. {}", numeral, point.text)
        } else {
            format!("{}. {}  ({})", numeral, point.text, verse)
        };
 
        writer.write_line(&heading, font_bold, SIZE_HEADING, 0.0, 2.0);
 
        if let Some(ref subpoints) = point.subpoints {
            for (j, sub) in subpoints.iter().enumerate() {
                let letter = ALPHA.get(j).copied().unwrap_or("·");
                let sub_line = format!("    {}.  {}", letter, sub);
                writer.write_line(&sub_line, font_regular, SIZE_BODY, 4.0, 1.5);
            }
        }
 
        writer.blank(3.0);
    }
 
    Ok(())
}
 
fn render_manuscript(
    writer:       &mut PageWriter,
    text:         &str,
    font_regular: &IndirectFontRef,
) -> Result<()> {
    for paragraph in text.split("\n\n") {
        let trimmed = paragraph.trim();
        if trimmed.is_empty() { continue; }
 
        for line in wrap_text(trimmed, 80) {
            writer.write_line(&line, font_regular, SIZE_BODY, 0.0, 1.5);
        }
 
        writer.blank(2.5);
    }
 
    Ok(())
}
 
fn render_notes(
    writer:       &mut PageWriter,
    text:         &str,
    font_regular: &IndirectFontRef,
) -> Result<()> {
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            writer.blank(2.0);
            continue;
        }
 
        let is_bullet = trimmed.starts_with('-') || trimmed.starts_with('•');
        let content: &str = if is_bullet { trimmed[1..].trim_start() } else { trimmed };
        let full_line = if is_bullet {
            format!("•  {}", content)
        } else {
            content.to_string()
        };
 
        writer.write_line(&full_line, font_regular, SIZE_BODY, 0.0, 1.5);
    }
 
    Ok(())
}
 
fn format_date(date_str: &str) -> String {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        dt.format("%B %-d, %Y").to_string()
    } else {
        date_str.to_string()
    }
}
 
fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines = Vec::new();
    let mut current = String::new();
 
    for word in words {
        if current.is_empty() {
            current = word.to_string();
        } else if current.len() + 1 + word.len() <= max_chars {
            current.push(' ');
            current.push_str(word);
        } else {
            lines.push(current.clone());
            current = word.to_string();
        }
    }
 
    if !current.is_empty() {
        lines.push(current);
    }
 
    lines
}
 