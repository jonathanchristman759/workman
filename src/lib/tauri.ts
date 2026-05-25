// Workman — tauri.ts
// src/lib/tauri.ts
// Typed bridge between the React frontend and Tauri Rust commands.
// Replaces api.ts entirely — all data access goes through invoke().
//
// Usage:
//   import { tauri } from '@/lib/tauri'
//   const sermons = await tauri.sermons.getAll()

import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'

// ─────────────────────────────────────────────
// SHARED TYPES
// Mirror the Rust structs from commands/
// ─────────────────────────────────────────────

export interface Sermon {
  id:            string
  seriesId?:     string | null
  title:         string
  passageRef:    string
  book?:         string | null
  chapterStart?: number | null
  chapterEnd?:   number | null
  mode:          'OUTLINE' | 'MANUSCRIPT' | 'NOTES'
  outlineJson?:  string | null
  manuscript?:   string | null
  notes?:        string | null
  wordCount:     number
  status:        'DRAFT' | 'IN_PROGRESS' | 'DELIVERED' | 'IMPORTED'
  deliveryDate?: string | null
  createdAt:     string
  updatedAt:     string
  seriesTitle?:  string | null
}

export interface SermonVersion {
  id:           string
  sermonId:     string
  snapshotJson: string
  savedAt:      string
}

export interface Series {
  id:          string
  title:       string
  description: string | null
  createdAt:   string
  updatedAt:   string
  sermonCount?: number
}

export interface LexiconWord {
  id:              string
  strongsNumber:   string
  language:        'GREEK' | 'HEBREW' | 'ARAMAIC'
  originalWord:    string
  transliteration: string
  pronunciation?:  string | null
  partOfSpeech?:   string | null
  glosses:         string[]
  definition?:     string | null
  ntOtCount?:      number | null
  occurrences:     LexiconOccurrence[]
}

export interface LexiconOccurrence {
  id:           string
  wordId:       string
  book:         string
  chapter:      number
  verse:        number
  kjvRendering: string
  parsing?:     string | null
}

export interface InterlinearWord {
  kjvRendering:    string
  parsing?:        string | null
  strongsNumber:   string
  language:        string
  originalWord:    string
  transliteration: string
  glosses:         string[]
  partOfSpeech?:   string | null
}

export interface LexiconBookmark {
  id:              string
  strongsNumber:   string
  originalWord:    string
  transliteration: string | null
  language:        string
  passageRef?:     string | null
  note?:           string | null
  savedAt:         string
}

export interface BibleVerse {
  id:          string
  translation: string
  book:        string
  bookNumber:  number
  chapter:     number
  verse:       number
  text:        string
}

export interface Illustration {
  id:          string
  title:       string
  body:        string
  source?:     string | null
  language:    string
  isCustom:    boolean
  isFavorited: boolean
  createdAt:   string
  tags:        IllustrationTag[]
}

export interface IllustrationTag {
  tag:      string
  category: string | null
}

export interface Settings {
  name:           string
  church?:        string | null
  denomination?:  string | null
  language:       'EN' | 'ES'
  theme:          string
  editorFontSize: number
  logosConnected: boolean
}

export interface ImportJob {
  id:            string
  status:        string
  totalFiles:    number
  completedFiles: number
  startedAt:     string
  completedAt?:  string | null
  items:         ImportItem[]
}

export interface ImportItem {
  id:               string
  jobId:            string
  sermonId?:        string | null
  originalFilename: string
  fileFormat:       string
  extractedText?:   string | null
  reviewStatus:     'PENDING' | 'APPROVED' | 'SKIPPED'
  importedAt:       string
}

export interface CoverageEntry {
  book:     string
  count:    number
  chapters: number[]
}

export interface RepeatWarning {
  message:      string
  lastPreached: string | null
  lastTitle:    string
}

export interface CreateSermonResult {
  sermon:        Sermon
  repeatWarning: RepeatWarning | null
}

// ─────────────────────────────────────────────
// TAURI BRIDGE
// ─────────────────────────────────────────────

export const tauri = {

  // ── SERMONS ────────────────────────────────

  sermons: {
    getAll: (params?: {
      search?:  string
      book?:    string
      status?:  string
      year?:    number
    }) => invoke<Sermon[]>('get_sermons', params ?? {}),

    get: (id: string) =>
      invoke<Sermon>('get_sermon', { id }),

    create: (input: {
      title:        string
      passageRef:   string
      book?:        string
      chapterStart?: number
      chapterEnd?:  number
      mode?:        string
      seriesId?:    string
      deliveryDate?: string
    }) => invoke<CreateSermonResult>('create_sermon', { input }),

    update: (id: string, input: Partial<{
      title:        string
      passageRef:   string
      book:         string | null
      chapterStart: number | null
      chapterEnd:   number | null
      mode:         string
      outlineJson:  string | null
      manuscript:   string | null
      notes:        string | null
      wordCount:    number
      status:       string
      seriesId:     string | null
      deliveryDate: string | null
      autosave:     boolean
    }>) => invoke<Sermon>('update_sermon', { id, input }),

    delete: (id: string) =>
      invoke<void>('delete_sermon', { id }),

    markDelivered: (id: string) =>
      invoke<Sermon>('mark_delivered', { id }),

    getVersions: (sermonId: string) =>
      invoke<SermonVersion[]>('get_versions', { sermonId }),

    restoreVersion: (sermonId: string, versionId: string) =>
      invoke<Sermon>('restore_version', { sermonId, versionId }),

    getCoverage: () =>
      invoke<CoverageEntry[]>('get_coverage'),

    exportPdf: async (id: string): Promise<string | null> => {
      // Open a native save dialog to let the pastor choose where to save
      const outputPath = await saveDialog({
        title:       'Export sermon as PDF',
        defaultPath: `sermon.pdf`,
        filters:     [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (!outputPath) return null

      return invoke<string>('export_sermon_pdf', { id, outputPath })
    },
  },

  // ── SERIES ─────────────────────────────────

  series: {
    getAll: () =>
      invoke<Series[]>('get_series'),

    get: (id: string) =>
      invoke<Series>('get_series_by_id', { id }),

    create: (input: { title: string; description?: string }) =>
      invoke<Series>('create_series', { input }),

    update: (id: string, input: { title?: string; description?: string | null }) =>
      invoke<Series>('update_series', { id, input }),

    delete: (id: string) =>
      invoke<void>('delete_series', { id }),
  },

  // ── LEXICON ────────────────────────────────

  lexicon: {
    getWord: (strongsNumber: string) =>
      invoke<LexiconWord>('get_word', { strongsNumber }),

    search: (query: string, language?: string) =>
      invoke<LexiconWord[]>('search_words', { query, language }),

    getVerseInterlinear: (
      book:        string,
      chapter:     number,
      verse:       number,
      translation?: string,
    ) => invoke<InterlinearWord[]>('get_verse_interlinear', { book, chapter, verse, translation }),

    getPassageInterlinear: (
      book:        string,
      chapter:     number,
      translation?: string,
    ) => invoke<Record<number, InterlinearWord[]>>('get_passage_interlinear', { book, chapter, translation }),

    getBookmarks: () =>
      invoke<LexiconBookmark[]>('get_bookmarks'),

    saveBookmark: (input: {
      strongsNumber:   string
      originalWord:    string
      transliteration?: string
      language:        string
      passageRef?:     string
      note?:           string
    }) => invoke<LexiconBookmark>('save_bookmark', { input }),

    deleteBookmark: (strongsNumber: string) =>
      invoke<void>('delete_bookmark', { strongsNumber }),

    openLogosLink: (strongsNumber: string, passageRef?: string) =>
      invoke<void>('open_logos_link', { strongsNumber, passageRef }),
  },

  // ── BIBLE TEXT ─────────────────────────────

  bible: {
    getVerse: (
      translation: string,
      book:        string,
      chapter:     number,
      verse:       number,
    ) => invoke<BibleVerse>('get_verse', { translation, book, chapter, verse }),

    getPassage: (
      translation: string,
      book:        string,
      chapter:     number,
    ) => invoke<BibleVerse[]>('get_passage', { translation, book, chapter }),

    search: (query: string, translation?: string) =>
      invoke<BibleVerse[]>('search_verses', { query, translation }),
  },

  // ── ILLUSTRATIONS ──────────────────────────

  illustrations: {
    getAll: (params?: {
      language?:     string
      search?:       string
      tag?:          string
      source?:       string
      favoritesOnly?: boolean
    }) => invoke<Illustration[]>('get_illustrations', params ?? {}),

    get: (id: string) =>
      invoke<Illustration>('get_illustration', { id }),

    create: (input: {
      title:    string
      body:     string
      source?:  string
      language?: string
      tags?:    { tag: string; category?: string }[]
    }) => invoke<Illustration>('create_illustration', { input }),

    update: (id: string, input: {
      title?:  string
      body?:   string
      source?: string | null
    }) => invoke<Illustration>('update_illustration', { id, input }),

    delete: (id: string) =>
      invoke<void>('delete_illustration', { id }),

    toggleFavorite: (id: string) =>
      invoke<boolean>('toggle_favorite', { id }),

    getTags: () =>
      invoke<{ tag: string; category: string | null }[]>('get_tags'),

    getSuggestions: (book?: string) =>
      invoke<string[]>('get_suggestions', { book }),
  },

  // ── IMPORT ─────────────────────────────────

  import: {
    // Opens a native file picker then passes the selected paths to Rust
    pickAndImport: async (): Promise<ImportJob | null> => {
      const selected = await openDialog({
        title:    'Import sermons',
        multiple: true,
        filters:  [
          {
            name:       'Sermon files',
            extensions: ['docx', 'pdf', 'txt', 'rtf', 'pages', 'zip'],
          },
        ],
      })

      if (!selected) return null

      const paths = Array.isArray(selected) ? selected : [selected]
      if (paths.length === 0) return null

      return invoke<ImportJob>('import_files', { filePaths: paths })
    },

    getJobs: () =>
      invoke<ImportJob[]>('get_import_jobs'),

    getJob: (jobId: string) =>
      invoke<ImportJob>('get_import_job', { jobId }),

    approveItem: (
      jobId:  string,
      itemId: string,
      input:  {
        title:         string
        passageRef:    string
        book?:         string
        chapterStart?: number
        deliveryDate?: string
        seriesId?:     string
      },
    ) => invoke<void>('approve_import_item', { jobId, itemId, input }),

    skipItem: (jobId: string, itemId: string) =>
      invoke<void>('skip_import_item', { jobId, itemId }),
  },

  // ── SETTINGS ───────────────────────────────

  settings: {
    get: () =>
      invoke<Settings>('get_settings'),

    update: (input: {
      name?:           string
      church?:         string | null
      denomination?:   string | null
      language?:       'EN' | 'ES'
      theme?:          string
      editorFontSize?: number
    }) => invoke<Settings>('update_settings', { input }),

    openLogosLink: (strongsNumber: string, passageRef?: string) =>
      invoke<void>('open_logos_link', { strongsNumber, passageRef }),
  },
}

// ─────────────────────────────────────────────
// MIGRATION HELPER
// Makes it easy to update existing components that used api.ts.
// Components can import `api` and it will call tauri under the hood.
// ─────────────────────────────────────────────

// The old api.get/post/patch/delete pattern is no longer needed —
// all calls go through the typed tauri object above.
// Update import paths from '@/lib/api' to '@/lib/tauri' and
// replace api.get('/sermons') with tauri.sermons.getAll() etc.
