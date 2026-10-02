import { UI_TEXT } from "@/constants/messages";

/** A placeholder until the landing page (plan §21, Phase 12). */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-2 p-6">
      <h1 className="text-3xl font-bold">{UI_TEXT.appName}</h1>
      <p>{UI_TEXT.appDescription}</p>
    </main>
  );
}
