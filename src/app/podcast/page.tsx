import { Suspense } from "react";
import { PodcastPage } from "./podcast-client";
export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Carregando podcast…</p>}>
      <PodcastPage />
    </Suspense>
  );
}
