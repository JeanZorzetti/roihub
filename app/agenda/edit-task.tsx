"use client";

import { useRef } from "react";
import { WD_LABELS, TIPOS, tipoDe, RESPONSAVEIS } from "@/lib/agenda.mjs";
import type { Task } from "@/lib/db";
import { update, promote } from "./actions";

/** Com acaoKey (ação do ranking): salvar cria tarefa no banco e risca a ação original. */
export function EditTask({
  task,
  done,
  acaoKey,
  slugs,
}: {
  task: Task;
  done: boolean;
  acaoKey?: string;
  slugs: string[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const auto = TIPOS.find((t: { id: string }) => t.id === tipoDe(task.titulo));
  return (
    <>
      <button
        type="button"
        className={done ? "ag-title done ag-edit" : "ag-title ag-edit"}
        onClick={() => ref.current?.showModal()}
        title="Editar tarefa"
      >
        {task.titulo}
      </button>
      <dialog ref={ref} className="ag-dialog">
        <form action={acaoKey ? promote : update} onSubmit={() => ref.current?.close()}>
          {acaoKey ? (
            <input type="hidden" name="key" value={acaoKey} />
          ) : (
            <input type="hidden" name="id" value={task.id} />
          )}
          <input name="titulo" defaultValue={task.titulo} required maxLength={200} className="ag-in" autoFocus />
          <textarea
            name="descricao"
            defaultValue={task.descricao ?? ""}
            placeholder="Descrição…"
            rows={4}
            maxLength={2000}
            className="ag-in"
          />
          <input type="date" name="due" defaultValue={task.due ?? ""} className="ag-in" title="Data (ignorada se repetir)" />
          <select name="weekday" defaultValue={task.weekday ?? ""} className="ag-in" title="Repetição">
            <option value="">não repete</option>
            <option value="7">todo dia</option>
            {WD_LABELS.map((l: string, i: number) => (
              <option key={l} value={i}>
                toda {l}
              </option>
            ))}
          </select>
          <select name="projeto" defaultValue={task.projeto ?? ""} className="ag-in" title="Projeto">
            <option value="">— projeto —</option>
            {slugs.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </select>
          <select name="tipo" defaultValue={task.tipo ?? ""} className="ag-in" title="Em que seção da agenda o card cai">
            <option value="">— automático ({auto?.label}) —</option>
            {TIPOS.map((t: { id: string; label: string; icone: string }) => (
              <option key={t.id} value={t.id}>
                {t.icone} {t.label}
              </option>
            ))}
          </select>
          <select name="responsavel" defaultValue={task.responsavel ?? ""} className="ag-in" title="Responsável">
            <option value="">— sem responsável —</option>
            {RESPONSAVEIS.map((r: { id: string; label: string }) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {acaoKey && (
            <p className="ag-desc">Salvar cria uma tarefa editável na agenda e risca esta ação do ranking.</p>
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
