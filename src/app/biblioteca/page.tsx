import { Suspense } from "react";
import { LibraryPage } from "./library-client";
export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Abrindo biblioteca…</p>}>
      <LibraryPage />
    </Suspense>
  );
}
