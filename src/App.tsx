import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CorpusPage } from "./pages/CorpusPage";
import { EntryPage } from "./pages/EntryPage";
import { LexiconPage } from "./pages/LexiconPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <CorpusPage /> },
      { path: "entry/:id", element: <EntryPage /> },
      { path: "word-list", element: <LexiconPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
