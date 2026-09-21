import { redirect } from "next/navigation";

// 052/D1 — 307 (não `permanentRedirect`/308): o 308 fica preso no navegador para sempre e
// impediria `/gsc/mapa` de virar seletor de projetos depois.
export default function Page() {
  redirect("/gsc/mapa/atma");
}
