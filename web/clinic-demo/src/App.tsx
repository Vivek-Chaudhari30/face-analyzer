import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoadingScan } from "./features/face-studio/LoadingScan";
import Home from "./pages/Home";
import Clinic from "./pages/Clinic";
import Business from "./pages/Business";
import Book from "./pages/Book";
import NotFound from "./pages/NotFound";

// The studio pulls in Three.js, so it is split into its own chunk.
const Studio = lazy(() => import("./pages/Studio"));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="clinic" element={<Clinic />} />
        <Route
          path="studio"
          element={
            <Suspense fallback={<LoadingScan label="Opening the studio" />}>
              <Studio />
            </Suspense>
          }
        />
        <Route path="for-clinics" element={<Business />} />
        <Route path="book" element={<Book />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
