import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './app/(auth)/login/page'
import SignupPage from './app/(auth)/signup/page'
import DashboardPage from './app/(app)/dashboard/page'
import LexiconPage from './app/(app)/lexicon/page'
import IllustrationsPage from './app/(app)/illustrations/page'
import ArchivePage from './app/(app)/archive/page'
import ImportPage from './app/(app)/archive/import/page'
import SettingsPage from './app/(app)/settings/page'
import SermonEditorPage from './app/(app)/sermons/[id]/page'
import NewSermonPage from './app/(app)/sermons/new/page'
import SermonsPage from './app/(app)/sermons/page'
import BiblePage from './app/(app)/bible/page'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/"              element={<Navigate to="/dashboard" />} />
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/signup"        element={<SignupPage />} />
      <Route path="/dashboard"     element={<DashboardPage />} />
      <Route path="/sermons/new"   element={<NewSermonPage />} />
      <Route path="/sermons/:id"   element={<SermonEditorPage />} />
      <Route path="/lexicon"       element={<LexiconPage />} />
      <Route path="/illustrations" element={<IllustrationsPage />} />
      <Route path="/archive"       element={<ArchivePage />} />
      <Route path="/archive/import" element={<ImportPage />} />
      <Route path="/settings"      element={<SettingsPage />} />
      <Route path="/sermons" element={<SermonsPage />} />
      <Route path="/bible" element={<BiblePage />} />
    </Routes>
  )
}