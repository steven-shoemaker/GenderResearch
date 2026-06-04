import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CorpusPage } from "./pages/CorpusPage";
import { EntryPage } from "./pages/EntryPage";
import { LexiconPage } from "./pages/LexiconPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CorpusPage />} />
          <Route path="entry/:id" element={<EntryPage />} />
          <Route path="word-list" element={<LexiconPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
