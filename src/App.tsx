import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CorpusPage } from "./pages/CorpusPage";
import { EntryPage } from "./pages/EntryPage";
import { ImportPage } from "./pages/ImportPage";
import { LexiconPage } from "./pages/LexiconPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <CorpusPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "entry/:id", element: <EntryPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "word-list", element: <LexiconPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
