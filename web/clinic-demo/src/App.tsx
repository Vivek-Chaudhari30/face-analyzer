import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoadingScan } from "./features/face-studio/LoadingScan";
import Home from "./pages/Home";
import Clinic from "./pages/Clinic";
import Business from "./pages/Business";
import Book from "./pages/Book";
import Treatments from "./pages/Treatments";
import TreatmentDetail from "./pages/TreatmentDetail";
import Explore from "./pages/Explore";
import NotFound from "./pages/NotFound";

// Studio pages pull in Three.js and MediaPipe, so they load as separate chunks.
const Studio = lazy(() => import("./pages/Studio"));
const StudioCompare = lazy(() => import("./pages/StudioCompare"));

const fallback = <LoadingScan label="Opening the studio" />;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="clinic" element={<Clinic />} />
        <Route path="treatments" element={<Treatments />} />
        <Route path="treatments/:id" element={<TreatmentDetail />} />
        <Route
          path="studio"
          element={
            <Suspense fallback={fallback}>
              <Studio />
            </Suspense>
          }
        />
        <Route
          path="studio/compare"
          element={
            <Suspense fallback={fallback}>
              <StudioCompare />
            </Suspense>
          }
        />
        <Route path="studio/explore" element={<Explore />} />
        <Route path="for-clinics" element={<Business />} />
        <Route path="book" element={<Book />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
