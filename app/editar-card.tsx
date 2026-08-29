"use client";

import { useRef } from "react";
import { CANAIS, TIPOS_CARD, TITULO_MAX, DESCRICAO_MAX } from "@/lib/pauta.mjs";
import { RESPONSAVEIS } from "@/lib/agenda.mjs";
import type { PautaCard, PautaColuna } from "@/lib/db";
import { updateCard } from "./quadro-actions";

type Opcao = { id: string; label: string };

/**
 * Único client component da feature — mesmo molde de agenda/edit-task.tsx: `<dialog>` nativo,
 * server action no `action` do form. Não há estado de cliente; a página é re-renderizada.
 */
export function EditarCard({
  card,
  colunas,
  slugs,
}: {
  card: PautaCard;
  colunas: PautaColuna[];
  slugs: string[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const marketing = card.quadro === "marketing";
  const doc = card.tipo === "doc";
  return (
    <>
      <button type="button" className="ag-title ag-edit" onClick={() => ref.current?.showModal()} title="Editar card">
        {card.titulo}
      </button>
      <dialog ref={ref} className="ag-dialog">
        <form action={updateCard} onSubmit={() => ref.current?.close()}>
          <input type="hidden" name="id" value={card.id} />
          <input type="hidden" name="quadro" value={card.quadro} />
          <input type="hidden" name="tipo" value={(TIPOS_CARD as string[]).includes(card.tipo) ? card.tipo : "card"} />
          <input name="titulo" defaultValue={card.titulo} required maxLength={TITULO_MAX} className="ag-in" autoFocus />
          <textarea
            name="descricao"
            defaultValue={card.descricao ?? ""}
            placeholder="Descrição…"
            rows={doc ? 12 : 5}
            maxLength={DESCRICAO_MAX}
            className="ag-in"
          />
          {!doc && (
            <select name="coluna_id" defaultValue={card.coluna_id ?? ""} className="ag-in" title="Coluna">
              {colunas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icone ? `${c.icone} ` : ""}
                  {c.nome}
                </option>
              ))}
            </select>
          )}
          <select name="projeto" defaultValue={card.projeto ?? ""} className="ag-in" title="Projeto">
            <option value="">— transversal (sem projeto) —</option>
            {slugs.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </select>
          <select name="responsavel" defaultValue={card.responsavel ?? ""} className="ag-in" title="Responsável">
            <option value="">— sem responsável —</option>
            {(RESPONSAVEIS as Opcao[]).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {marketing && !doc && (
            <>
              <select name="canal" defaultValue={card.canal ?? ""} className="ag-in" title="Canal de publicação">
                <option value="">— canal —</option>
                {(CANAIS as Opcao[]).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="data"
                defaultValue={card.data ?? ""}
                className="ag-in"
                title="Data de publicação (alimenta o calendário)"
              />
              <input
                name="url"
                type="url"
                defaultValue={card.url ?? ""}
                placeholder="https://… (post no ar)"
                maxLength={500}
                className="ag-in"
              />
            </>
          )}
          <div className="ag-dialog-actions">
            <button type="button" className="ag-in" onClick={() => ref.current?.close()}>
              Cancelar
            </button>
            <button className="ag-btn">Salvar</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
