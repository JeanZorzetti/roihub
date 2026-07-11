"use client";

import { useRef } from "react";
import projects from "@/data/projects.json";
import { WD_LABELS } from "@/lib/agenda.mjs";
import type { Task } from "@/lib/db";
import { update } from "./actions";

export function EditTask({ task, done }: { task: Task; done: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
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
        <form action={update} onSubmit={() => ref.current?.close()}>
          <input type="hidden" name="id" value={task.id} />
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
          <select name="weekday" defaultValue={task.weekday ?? ""} className="ag-in" title="Repetição semanal">
            <option value="">não repete</option>
            {WD_LABELS.map((l: string, i: number) => (
              <option key={l} value={i}>
                toda {l}
              </option>
            ))}
          </select>
          <select name="projeto" defaultValue={task.projeto ?? ""} className="ag-in" title="Projeto">
            <option value="">— projeto —</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.slug}
              </option>
            ))}
          </select>
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
