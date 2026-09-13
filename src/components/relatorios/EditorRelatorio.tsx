"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { IconPlus } from "@/components/admin/icons";
import { ResumoRelatorio } from "@/components/relatorios/ResumoRelatorio";
import {
  apagarLinha,
  consultarVersaoRelatorio,
  finalizarRelatorio,
  guardarLinha,
  type ResultadoLinha,
} from "@/server/actions/relatorios";
import { centimosParaTexto, formatCentimos, parseValorCentimos } from "@/lib/relatorios/dinheiro";
import {
  ROTULO_TIPO,
  calcularTotais,
  type LinhaVista,
  type TipoLinha,
} from "@/lib/relatorios/resumo";

type Campos = {
  tipo: TipoLinha;
  descricao: string;
  /** Exactly what was typed; parsed to cêntimos on save. */
  valor: string;
  metodoPagamentoId: string;
};

type Estado =
  | "nova"
  | "guardada"
  | "por_guardar"
  | "a_guardar"
  | "incompleta"
  | "erro"
  | "sem_ligacao"
  | "conflito";

type Linha = {
  id: string;
  /** The last copy the server confirmed; null until the first save lands. */
  base: LinhaVista | null;
  campos: Campos;
  estado: Estado;
  mensagem?: string;
  errors?: Record<string, string[]>;
  /** In the "conflito" state: the row as the server has it, or null if deleted. */
  atual?: LinhaVista | null;
  /** Restored from this device's backup of a previous visit. */
  recuperada?: boolean;
};

type Metodo = { id: string; nome: string };

const TIPOS: TipoLinha[] = ["VENDA", "DESPESA"];

/** Debounce while typing; a blur or a pick saves at once. */
const ATRASO_ESCRITA = 800;
const ATRASO_RELIGAR = 5000;

function camposDe(linha: LinhaVista): Campos {
  return {
    tipo: linha.tipo,
    descricao: linha.descricao,
    valor: centimosParaTexto(linha.valorCentimos),
    metodoPagamentoId: linha.metodoPagamentoId,
  };
}

function iguais(campos: Campos, base: LinhaVista): boolean {
  return (
    campos.tipo === base.tipo &&
    campos.descricao.trim() === base.descricao &&
    parseValorCentimos(campos.valor) === base.valorCentimos &&
    campos.metodoPagamentoId === base.metodoPagamentoId
  );
}

function vazia(campos: Campos): boolean {
  return !campos.descricao.trim() && !campos.valor.trim();
}

function completa(campos: Campos): boolean {
  const valor = parseValorCentimos(campos.valor);
  return (
    campos.descricao.trim().length >= 2 &&
    valor !== null &&
    valor > 0 &&
    campos.metodoPagamentoId !== ""
  );
}

function novoId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Local backup ----------
//
// Each line is saved to the server as soon as it is complete, but a line still
// being typed — or one whose save could not get through — only exists in this
// tab. Mirroring those to localStorage means a closed browser or a phone that
// discards the tab loses nothing: the next visit restores them.
//
// localStorage is shared by every tab, so each entry names the tab that owns
// it and when that tab last confirmed it. A tab only restores its own entries
// (after a reload) or ones whose owner has gone quiet — never the half-typed
// line of a tab that is still open next to it.

type Pendente = {
  campos: Campos;
  baseVersao: number | null;
  /** The report's version when this was written; a mismatch means it changed since. */
  versaoRelatorio: number;
  dono: string;
  visto: number;
};

const chaveBackup = (relatorioId: string) => `dufat:relatorio:${relatorioId}:pendentes`;

/** An open tab re-confirms its entries this often… */
const BATIMENTO = 5_000;
/** …so an entry older than this belongs to a tab that is gone. */
const ORFA_APOS = 15_000;
/** Entries nobody came back for are eventually dropped. */
const EXPIRA_APOS = 14 * 24 * 3_600_000;

/** Stable for a tab across reloads, distinct between tabs. */
function idDoSeparador(): string {
  try {
    const existente = window.sessionStorage.getItem("dufat:separador");
    if (existente) return existente;
    const novo = novoId();
    window.sessionStorage.setItem("dufat:separador", novo);
    return novo;
  } catch {
    return novoId();
  }
}

function lerPendentes(relatorioId: string): Record<string, Pendente> {
  try {
    const bruto = window.localStorage.getItem(chaveBackup(relatorioId));
    const valor: unknown = bruto ? JSON.parse(bruto) : null;
    if (!valor || typeof valor !== "object") return {};
    const pendentes: Record<string, Pendente> = {};
    for (const [id, entrada] of Object.entries(valor as Record<string, unknown>)) {
      const p = entrada as Partial<Pendente> | null;
      const c = p?.campos as Partial<Campos> | undefined;
      if (
        p &&
        c &&
        TIPOS.includes(c.tipo as TipoLinha) &&
        typeof c.descricao === "string" &&
        typeof c.valor === "string" &&
        typeof c.metodoPagamentoId === "string" &&
        (p.baseVersao === null || typeof p.baseVersao === "number") &&
        typeof p.versaoRelatorio === "number" &&
        typeof p.dono === "string" &&
        typeof p.visto === "number"
      ) {
        pendentes[id] = p as Pendente;
      }
    }
    return pendentes;
  } catch {
    return {};
  }
}

/**
 * Replaces this tab's entries with its current unsaved lines, leaving other
 * tabs' entries alone. `libertar` drops entries this tab has just taken over.
 */
function gravarPendentes(
  relatorioId: string,
  linhas: readonly Linha[],
  dono: string,
  versaoRelatorio: number,
  libertar: readonly string[] = [],
): void {
  try {
    const agora = Date.now();
    const mapa = lerPendentes(relatorioId);
    for (const [id, pendente] of Object.entries(mapa)) {
      if (pendente.dono === dono || agora - pendente.visto > EXPIRA_APOS || libertar.includes(id)) {
        delete mapa[id];
      }
    }
    for (const linha of linhas) {
      if (linha.estado === "guardada") continue;
      if (!linha.base && vazia(linha.campos)) continue;
      mapa[linha.id] = {
        campos: linha.campos,
        baseVersao: linha.base?.versao ?? null,
        versaoRelatorio,
        dono,
        visto: agora,
      };
    }
    if (Object.keys(mapa).length === 0) {
      window.localStorage.removeItem(chaveBackup(relatorioId));
    } else {
      window.localStorage.setItem(chaveBackup(relatorioId), JSON.stringify(mapa));
    }
  } catch {
    // Storage blocked or full: the server copy is still the record.
  }
}

const temPorGuardar = (linhas: readonly Linha[]) =>
  linhas.some((l) => l.estado !== "guardada" && !(l.base === null && vazia(l.campos)));

type Props = {
  relatorioId: string;
  versao: number;
  linhas: LinhaVista[];
  /** Active methods only; a line on a retired method still shows its name. */
  metodos: Metodo[];
};

/**
 * The draft report, edited in place.
 *
 * Every line saves itself: shortly after typing stops, on blur, or right after
 * a pick. The server is the record; this component keeps just enough state to
 * say what is saved, to retry what is not, and to surface — rather than
 * overwrite — changes made in another tab.
 */
export function EditorRelatorio({ relatorioId, versao, linhas: linhasServidor, metodos }: Props) {
  const router = useRouter();

  const [linhas, setLinhas] = useState<Linha[]>(() =>
    linhasServidor.map((linha) => ({
      id: linha.id,
      base: linha,
      campos: camposDe(linha),
      estado: "guardada",
    })),
  );
  // Saves resolve long after the render that started them; they read and write
  // through this ref so they never act on a stale copy of the lines.
  const linhasRef = useRef(linhas);
  const versaoRef = useRef(versao);
  const emVoo = useRef(new Set<string>());
  const repetir = useRef(new Set<string>());
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const guardarRef = useRef<(id: string) => Promise<void>>(async () => {});
  const donoRef = useRef<string | null>(null);
  /** Set once the server refuses writes: edits made since are not worth keeping. */
  const descartarBackup = useRef(false);

  const dono = () => (donoRef.current ??= idDoSeparador());

  const [fechado, setFechado] = useState<string | null>(null);
  const [aApagar, setAApagar] = useState<string | null>(null);
  const [aFinalizar, setAFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [avisoFinalizar, setAvisoFinalizar] = useState<string | null>(null);

  function atualizar(fn: (atuais: Linha[]) => Linha[]) {
    const proximas = fn(linhasRef.current);
    linhasRef.current = proximas;
    setLinhas(proximas);
  }

  function mudarLinha(id: string, patch: Partial<Linha>) {
    atualizar((atuais) => atuais.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function agendar(id: string, atraso: number) {
    const anterior = temporizadores.current.get(id);
    if (anterior) clearTimeout(anterior);
    temporizadores.current.set(
      id,
      setTimeout(() => {
        temporizadores.current.delete(id);
        void guardarRef.current(id);
      }, atraso),
    );
  }

  async function guardar(id: string) {
    const linha = linhasRef.current.find((l) => l.id === id);
    if (!linha || linha.estado === "conflito") return;

    if (linha.base && iguais(linha.campos, linha.base)) {
      if (linha.estado !== "guardada") {
        mudarLinha(id, { estado: "guardada", mensagem: undefined, errors: undefined });
      }
      return;
    }
    if (!linha.base && vazia(linha.campos)) {
      mudarLinha(id, { estado: "nova" });
      return;
    }
    if (!completa(linha.campos)) {
      mudarLinha(id, { estado: "incompleta", mensagem: undefined });
      return;
    }
    // One save per line at a time, so versions are always based on the last
    // confirmed copy; an edit made meanwhile goes out when this one returns.
    if (emVoo.current.has(id)) {
      repetir.current.add(id);
      return;
    }

    emVoo.current.add(id);
    const enviados = linha.campos;
    mudarLinha(id, { estado: "a_guardar", mensagem: undefined, errors: undefined });

    let resultado: ResultadoLinha;
    try {
      resultado = await guardarLinha({
        relatorioId,
        id,
        versao: linha.base?.versao ?? null,
        ...enviados,
      });
    } catch {
      emVoo.current.delete(id);
      repetir.current.delete(id);
      mudarLinha(id, { estado: "sem_ligacao" });
      agendar(id, ATRASO_RELIGAR);
      return;
    }
    emVoo.current.delete(id);

    const atual = linhasRef.current.find((l) => l.id === id);
    if (!atual) return;

    if (resultado.ok) {
      versaoRef.current = Math.max(versaoRef.current, resultado.versaoRelatorio);
      const mudou = atual.campos !== enviados;
      mudarLinha(id, { base: resultado.linha, estado: mudou ? "por_guardar" : "guardada" });
      if (repetir.current.delete(id) || mudou) agendar(id, 0);
      return;
    }

    repetir.current.delete(id);
    switch (resultado.codigo) {
      case "CONFLITO":
        mudarLinha(id, { estado: "conflito", atual: resultado.atual, mensagem: resultado.message });
        break;
      case "VALIDACAO":
        mudarLinha(id, { estado: "erro", mensagem: resultado.message, errors: resultado.errors });
        break;
      case "FECHADO":
      case "SEM_ACESSO":
        fecharEditor(resultado.message);
        break;
      default:
        mudarLinha(id, { estado: "erro", mensagem: resultado.message });
    }
  }

  /**
   * The server stopped taking writes: the report was finalized elsewhere, or
   * this person's access was removed. Whatever this tab still holds was
   * refused, so it is dropped from the backup too — otherwise a later reopen
   * or re-grant would bring it back as if it had been meant for later.
   */
  function fecharEditor(mensagem: string) {
    descartarBackup.current = true;
    gravarPendentes(relatorioId, [], dono(), versaoRef.current);
    setFechado(mensagem);
    router.refresh();
  }

  useEffect(() => {
    guardarRef.current = guardar;
  });

  function editar(id: string, patch: Partial<Campos>, atraso = ATRASO_ESCRITA) {
    atualizar((atuais) =>
      atuais.map((l) => {
        if (l.id !== id) return l;
        const errors = l.errors ? { ...l.errors } : undefined;
        if (errors) for (const campo of Object.keys(patch)) delete errors[campo];
        const estado: Estado =
          l.estado === "conflito" || l.estado === "a_guardar" ? l.estado : "por_guardar";
        return { ...l, campos: { ...l.campos, ...patch }, estado, errors };
      }),
    );
    agendar(id, atraso);
  }

  function adicionar(tipo: TipoLinha) {
    const id = novoId();
    atualizar((atuais) => [
      ...atuais,
      {
        id,
        base: null,
        campos: {
          tipo,
          descricao: "",
          valor: "",
          metodoPagamentoId: metodos.length === 1 ? metodos[0]!.id : "",
        },
        estado: "nova",
      },
    ]);
    requestAnimationFrame(() => document.getElementById(`descricao-${id}`)?.focus());
  }

  function remover(id: string) {
    const temporizador = temporizadores.current.get(id);
    if (temporizador) clearTimeout(temporizador);
    temporizadores.current.delete(id);
    atualizar((atuais) => atuais.filter((l) => l.id !== id));
  }

  function pedirApagar(id: string) {
    const linha = linhasRef.current.find((l) => l.id === id);
    if (!linha) return;
    // Never reached the server: nothing to delete there, nothing to confirm.
    if (!linha.base && linha.estado !== "conflito") {
      remover(id);
      return;
    }
    setAApagar(id);
  }

  async function confirmarApagar() {
    const id = aApagar;
    setAApagar(null);
    const linha = linhasRef.current.find((l) => l.id === id);
    if (!id || !linha) return;
    if (!linha.base) {
      remover(id);
      return;
    }

    const temporizador = temporizadores.current.get(id);
    if (temporizador) clearTimeout(temporizador);
    mudarLinha(id, { estado: "a_guardar", mensagem: undefined });

    try {
      const resultado = await apagarLinha({ relatorioId, id, versao: linha.base.versao });
      if (resultado.ok) {
        versaoRef.current = Math.max(versaoRef.current, resultado.versaoRelatorio);
        remover(id);
      } else if (resultado.codigo === "CONFLITO") {
        mudarLinha(id, { estado: "conflito", atual: resultado.atual, mensagem: resultado.message });
      } else if (resultado.codigo === "FECHADO" || resultado.codigo === "SEM_ACESSO") {
        fecharEditor(resultado.message);
      } else {
        mudarLinha(id, { estado: "erro", mensagem: resultado.message });
      }
    } catch {
      mudarLinha(id, {
        estado: "erro",
        mensagem: "Sem ligação — a linha não foi apagada. Tente de novo.",
      });
    }
  }

  function usarGuardada(id: string) {
    const linha = linhasRef.current.find((l) => l.id === id);
    if (!linha) return;
    if (!linha.atual) {
      remover(id);
      return;
    }
    mudarLinha(id, {
      base: linha.atual,
      campos: camposDe(linha.atual),
      estado: "guardada",
      atual: undefined,
      mensagem: undefined,
      errors: undefined,
    });
  }

  function manterMinha(id: string) {
    const linha = linhasRef.current.find((l) => l.id === id);
    if (!linha) return;
    // Based on the server's copy now, so the save is an informed overwrite —
    // or, for a line deleted elsewhere, a deliberate re-creation.
    mudarLinha(id, {
      base: linha.atual ?? null,
      estado: "por_guardar",
      atual: undefined,
      mensagem: undefined,
    });
    agendar(id, 0);
  }

  // Restore anything a previous visit could not save.
  const restaurado = useRef(false);
  useEffect(() => {
    if (restaurado.current) return;
    restaurado.current = true;

    const agora = Date.now();
    const candidatos = Object.entries(lerPendentes(relatorioId)).filter(
      ([, p]) => p.dono === dono() || agora - p.visto > ORFA_APOS,
    );
    if (candidatos.length === 0) return;

    const doServidor = new Map(linhasServidor.map((l) => [l.id, l]));
    const aGuardar: string[] = [];

    atualizar((atuais) => {
      const porId = new Map(atuais.map((l) => [l.id, l]));
      const extra: Linha[] = [];

      for (const [id, pendente] of candidatos) {
        // Anything changed in the report since this was written — another
        // tab's edits, a finalization and reopening — and it is no longer
        // safe to apply unseen: it comes back as a choice, not a save.
        const mudou = pendente.versaoRelatorio !== versao;
        const servidor = doServidor.get(id);

        if (servidor) {
          if (iguais(pendente.campos, servidor)) continue;
          const local = porId.get(id)!;
          if (!mudou && pendente.baseVersao === servidor.versao) {
            porId.set(id, { ...local, campos: pendente.campos, estado: "por_guardar", recuperada: true });
            aGuardar.push(id);
          } else {
            porId.set(id, {
              ...local,
              campos: pendente.campos,
              estado: "conflito",
              atual: servidor,
              recuperada: true,
              mensagem:
                "Recuperámos alterações por guardar, mas o relatório foi alterado entretanto.",
            });
          }
        } else if (!porId.has(id) && !vazia(pendente.campos)) {
          if (!mudou && pendente.baseVersao === null) {
            extra.push({ id, base: null, campos: pendente.campos, estado: "por_guardar", recuperada: true });
            aGuardar.push(id);
          } else {
            extra.push({
              id,
              base: null,
              campos: pendente.campos,
              estado: "conflito",
              atual: null,
              recuperada: true,
              mensagem:
                pendente.baseVersao === null
                  ? "Recuperámos uma linha por guardar, mas o relatório foi alterado entretanto."
                  : "Recuperámos alterações por guardar de uma linha entretanto apagada.",
            });
          }
        }
      }

      return [...atuais.map((l) => porId.get(l.id)!), ...extra];
    });

    // Take the restored entries over from the tab that left them, so no other
    // tab restores them a second time.
    gravarPendentes(
      relatorioId,
      linhasRef.current,
      dono(),
      versaoRef.current,
      candidatos.map(([id]) => id),
    );
    for (const id of aGuardar) agendar(id, 0);
    // Mount only: this reads the backup once, against the lines first rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fresh server data (after a refresh): take what changed elsewhere, keep what
  // is being edited here, and flag the lines where both happened.
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    // Older than what this tab has already written: a refresh that started
    // before our own save landed. Nothing in it is news.
    if (versao < versaoRef.current) return;
    versaoRef.current = versao;

    const doServidor = new Map(linhasServidor.map((l) => [l.id, l]));
    atualizar((atuais) => {
      const vistas = new Set<string>();
      const resultado: Linha[] = [];

      for (const local of atuais) {
        vistas.add(local.id);
        const servidor = doServidor.get(local.id);
        const ocupada = emVoo.current.has(local.id);

        if (servidor) {
          if ((local.base && local.base.versao >= servidor.versao) || ocupada) {
            resultado.push(local);
          } else if (local.estado === "guardada") {
            resultado.push({ id: local.id, base: servidor, campos: camposDe(servidor), estado: "guardada" });
          } else if (!local.base) {
            resultado.push(local);
          } else {
            resultado.push({
              ...local,
              estado: "conflito",
              atual: servidor,
              mensagem: "Esta linha foi alterada noutra janela.",
            });
          }
        } else if (!local.base || ocupada) {
          resultado.push(local);
        } else if (local.estado !== "guardada") {
          resultado.push({
            ...local,
            estado: "conflito",
            atual: null,
            mensagem: "Esta linha foi apagada noutra janela.",
          });
        }
        // A clean line missing from the server was deleted elsewhere: dropped.
      }

      for (const servidor of linhasServidor) {
        if (!vistas.has(servidor.id)) {
          resultado.push({
            id: servidor.id,
            base: servidor,
            campos: camposDe(servidor),
            estado: "guardada",
          });
        }
      }
      return resultado;
    });
  }, [linhasServidor, versao]);

  useEffect(() => {
    const gravar = () => {
      if (!descartarBackup.current) {
        gravarPendentes(relatorioId, linhasRef.current, dono(), versaoRef.current);
      }
    };
    gravar();
    if (!temPorGuardar(linhas)) return;
    // Keeps this tab's entries fresh so other tabs leave them alone.
    const batimento = setInterval(gravar, BATIMENTO);
    return () => clearInterval(batimento);
  }, [relatorioId, linhas]);

  // Coming back to this tab: if another tab (or device) changed the report,
  // pull the fresh copy instead of carrying on from a stale one.
  useEffect(() => {
    let ultima = 0;
    const verificar = async () => {
      if (document.visibilityState !== "visible") return;
      const agora = Date.now();
      if (agora - ultima < 2000) return;
      ultima = agora;
      try {
        const estado = await consultarVersaoRelatorio(relatorioId);
        // null: the report is gone or this person's access was removed — the
        // refreshed page will say so.
        if (!estado || estado.estado !== "RASCUNHO" || estado.versao > versaoRef.current) {
          router.refresh();
        }
      } catch {
        // Offline; the "online" handler will try again.
      }
    };
    const religado = () => {
      for (const linha of linhasRef.current) {
        if (linha.estado === "sem_ligacao") agendar(linha.id, 0);
      }
      void verificar();
    };

    document.addEventListener("visibilitychange", verificar);
    window.addEventListener("focus", verificar);
    window.addEventListener("online", religado);
    return () => {
      document.removeEventListener("visibilitychange", verificar);
      window.removeEventListener("focus", verificar);
      window.removeEventListener("online", religado);
    };
  }, [relatorioId, router]);

  useEffect(() => {
    const avisar = (event: BeforeUnloadEvent) => {
      const porGuardar = linhasRef.current.some((l) =>
        ["por_guardar", "a_guardar", "sem_ligacao"].includes(l.estado),
      );
      if (porGuardar) event.preventDefault();
    };
    const pendentes = temporizadores.current;
    window.addEventListener("beforeunload", avisar);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      for (const temporizador of pendentes.values()) clearTimeout(temporizador);
    };
  }, []);

  async function confirmarFinalizar() {
    setAFinalizar(false);
    setFinalizando(true);
    setAvisoFinalizar(null);
    try {
      const resultado = await finalizarRelatorio({ id: relatorioId, versao: versaoRef.current });
      if (resultado.ok) {
        // Closed for everyone: no tab's leftovers apply to it any more.
        descartarBackup.current = true;
        try {
          window.localStorage.removeItem(chaveBackup(relatorioId));
        } catch {
          // Storage blocked: nothing was backed up either.
        }
        router.refresh();
        return;
      }
      setAvisoFinalizar(resultado.message);
      if (resultado.codigo === "FECHADO" || resultado.codigo === "SEM_ACESSO") {
        fecharEditor(resultado.message);
      }
      else if (resultado.codigo === "CONFLITO") router.refresh();
    } catch {
      setAvisoFinalizar("Sem ligação — o relatório não foi finalizado. Tente de novo.");
    }
    setFinalizando(false);
  }

  // ---------- Derived ----------

  const nomes = new Map(metodos.map((m) => [m.id, m.nome]));

  const totais = calcularTotais(
    linhas.flatMap((l) => {
      const valor = parseValorCentimos(l.campos.valor);
      if (valor === null || valor <= 0 || !l.campos.metodoPagamentoId) return [];
      const metodoPagamentoNome =
        l.base && l.base.metodoPagamentoId === l.campos.metodoPagamentoId
          ? l.base.metodoPagamentoNome
          : (nomes.get(l.campos.metodoPagamentoId) ?? "—");
      return [{ tipo: l.campos.tipo, valorCentimos: valor, metodoPagamentoNome }];
    }),
  );

  const porResolver = linhas.filter((l) => l.estado !== "guardada" && l.estado !== "nova");
  const aGuardar = linhas.some((l) => l.estado === "a_guardar" || l.estado === "por_guardar");
  const semLigacao = linhas.some((l) => l.estado === "sem_ligacao");
  const podeFinalizar = !fechado && !finalizando && porResolver.length === 0;

  const estadoGeral = semLigacao
    ? { texto: "Sem ligação — as alterações ficam neste dispositivo e são enviadas ao religar.", cor: "text-amber-600" }
    : aGuardar
      ? { texto: "A guardar…", cor: "text-a-muted" }
      : porResolver.length > 0
        ? { texto: `${porResolver.length} linha(s) por resolver.`, cor: "text-amber-600" }
        : { texto: "Todas as alterações guardadas.", cor: "text-emerald-600" };

  const linhaAApagar = linhas.find((l) => l.id === aApagar);
  const recuperadas = linhas.filter((l) => l.recuperada).length;

  return (
    <div className="space-y-6">
      {fechado && (
        <p role="alert" className="card-admin border-rose-500/40 p-4 text-sm text-a-text">
          {fechado}
        </p>
      )}

      {recuperadas > 0 && (
        <p role="status" className="card-admin border-lumen/40 p-4 text-sm text-a-text">
          Recuperámos {recuperadas} linha(s) que ficaram por guardar na última visita.
        </p>
      )}

      {metodos.length === 0 && (
        <p className="card-admin border-lumen/40 p-4 text-sm text-a-text">
          Ainda não há métodos de pagamento disponíveis. Peça ao administrador para os criar antes
          de registar vendas ou despesas.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className={cn("text-sm", estadoGeral.cor)}>
          {estadoGeral.texto}
        </p>
        <div className="flex gap-2">
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => adicionar(tipo)}
              disabled={metodos.length === 0 || Boolean(fechado)}
              className={cn(tipo === "VENDA" ? "btn-admin" : "btn-admin-ghost", "min-h-11")}
            >
              <IconPlus className="h-4 w-4" />
              {ROTULO_TIPO[tipo]}
            </button>
          ))}
        </div>
      </div>

      {linhas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-a-line-strong p-10 text-center">
          <p className="font-semibold text-a-text">Ainda sem linhas.</p>
          <p className="mt-1 text-sm text-a-muted">
            Adicione as vendas e despesas do dia. Cada linha é guardada automaticamente.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {linhas.map((linha) => (
            <LinhaEditor
              key={linha.id}
              linha={linha}
              metodos={metodos}
              nomes={nomes}
              bloqueada={Boolean(fechado)}
              onEditar={(patch, atraso) => editar(linha.id, patch, atraso)}
              onBlur={() => agendar(linha.id, 0)}
              onApagar={() => pedirApagar(linha.id)}
              onTentar={() => {
                mudarLinha(linha.id, { estado: "por_guardar", mensagem: undefined });
                agendar(linha.id, 0);
              }}
              onUsarGuardada={() => usarGuardada(linha.id)}
              onManterMinha={() => manterMinha(linha.id)}
            />
          ))}
        </ul>
      )}

      <ResumoRelatorio
        totais={totais}
        nota={porResolver.length > 0 ? "Os totais incluem linhas ainda por guardar." : undefined}
      />

      <div className="card-admin flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="min-w-0 text-sm text-a-muted">
          {avisoFinalizar ? (
            <span role="alert" className="text-rose-500">
              {avisoFinalizar}
            </span>
          ) : porResolver.length > 0 ? (
            "Guarde ou resolva todas as linhas antes de finalizar."
          ) : (
            "Quando terminar o dia, finalize o relatório. Depois disso já não o pode alterar."
          )}
        </p>
        <button
          type="button"
          onClick={() => setAFinalizar(true)}
          disabled={!podeFinalizar}
          className="btn-admin min-h-11 px-6"
        >
          {finalizando ? "A finalizar…" : "Finalizar relatório"}
        </button>
      </div>

      <ConfirmDialog
        open={aFinalizar}
        tone="primary"
        confirmLabel="Finalizar relatório"
        message={`Finalizar este relatório?\n\nVendas ${formatCentimos(totais.vendas)} · Despesas ${formatCentimos(totais.despesas)} · Saldo ${formatCentimos(totais.saldo)}.\n\nDepois de finalizado não o pode alterar — só um administrador o pode reabrir.`}
        onCancel={() => setAFinalizar(false)}
        onConfirm={() => void confirmarFinalizar()}
      />

      <ConfirmDialog
        open={Boolean(aApagar)}
        confirmLabel="Apagar linha"
        message={`Apagar ${linhaAApagar ? `"${linhaAApagar.campos.descricao || ROTULO_TIPO[linhaAApagar.campos.tipo]}"` : "esta linha"}?\n\nFica registado no histórico do relatório.`}
        onCancel={() => setAApagar(null)}
        onConfirm={() => void confirmarApagar()}
      />
    </div>
  );
}

const ROTULO_ESTADO: Record<Estado, { texto: string; cor: string }> = {
  nova: { texto: "Nova linha", cor: "text-a-faint" },
  guardada: { texto: "Guardada", cor: "text-emerald-600" },
  por_guardar: { texto: "Por guardar…", cor: "text-a-muted" },
  a_guardar: { texto: "A guardar…", cor: "text-a-muted" },
  incompleta: { texto: "Incompleta — não guardada", cor: "text-amber-600" },
  erro: { texto: "Não guardada", cor: "text-rose-500" },
  sem_ligacao: { texto: "Sem ligação — a tentar de novo", cor: "text-amber-600" },
  conflito: { texto: "Conflito", cor: "text-amber-600" },
};

function LinhaEditor({
  linha,
  metodos,
  nomes,
  bloqueada,
  onEditar,
  onBlur,
  onApagar,
  onTentar,
  onUsarGuardada,
  onManterMinha,
}: {
  linha: Linha;
  metodos: Metodo[];
  nomes: Map<string, string>;
  bloqueada: boolean;
  onEditar: (patch: Partial<Campos>, atraso?: number) => void;
  onBlur: () => void;
  onApagar: () => void;
  onTentar: () => void;
  onUsarGuardada: () => void;
  onManterMinha: () => void;
}) {
  const { campos, estado } = linha;
  const rotulo = ROTULO_ESTADO[estado];
  const metodoRetirado =
    campos.metodoPagamentoId !== "" && !nomes.has(campos.metodoPagamentoId);

  return (
    <li
      id={`linha-${linha.id}`}
      className={cn(
        "card-admin p-4",
        estado === "conflito" && "border-amber-500/50",
        estado === "erro" && "border-rose-500/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="radiogroup"
          aria-label="Tipo de linha"
          className="inline-flex rounded-full border border-a-line p-0.5"
        >
          {TIPOS.map((tipo) => {
            const ativo = campos.tipo === tipo;
            return (
              <button
                key={tipo}
                type="button"
                role="radio"
                aria-checked={ativo}
                disabled={bloqueada}
                onClick={() => onEditar({ tipo }, 0)}
                className={cn(
                  "min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors",
                  ativo
                    ? tipo === "VENDA"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-rose-500/15 text-rose-500"
                    : "text-a-muted hover:text-a-text",
                )}
              >
                {ROTULO_TIPO[tipo]}
              </button>
            );
          })}
        </div>

        <span className={cn("text-xs font-medium", rotulo.cor)}>{rotulo.texto}</span>

        <button
          type="button"
          onClick={onApagar}
          disabled={bloqueada || estado === "a_guardar"}
          className="btn-row-danger ml-auto min-h-9 px-3 text-xs disabled:opacity-40"
        >
          Apagar
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_13rem]">
        <AdminField
          label="Descrição"
          htmlFor={`descricao-${linha.id}`}
          errors={linha.errors?.descricao}
        >
          <input
            id={`descricao-${linha.id}`}
            value={campos.descricao}
            maxLength={200}
            disabled={bloqueada}
            autoComplete="off"
            onChange={(event) => onEditar({ descricao: event.target.value })}
            onBlur={onBlur}
            className={adminInputClass}
            placeholder={
              campos.tipo === "VENDA" ? "Ex.: 2 luminárias ST89" : "Ex.: combustível da carrinha"
            }
          />
        </AdminField>

        <AdminField label="Valor (Kz)" htmlFor={`valor-${linha.id}`} errors={linha.errors?.valor}>
          <input
            id={`valor-${linha.id}`}
            value={campos.valor}
            inputMode="decimal"
            autoComplete="off"
            disabled={bloqueada}
            onChange={(event) => onEditar({ valor: event.target.value })}
            onBlur={onBlur}
            className={cn(adminInputClass, "text-right font-mono tabular-nums")}
            placeholder="0,00"
          />
        </AdminField>

        <AdminField
          label="Método de pagamento"
          htmlFor={`metodo-${linha.id}`}
          errors={linha.errors?.metodoPagamentoId}
        >
          <select
            id={`metodo-${linha.id}`}
            value={campos.metodoPagamentoId}
            disabled={bloqueada}
            onChange={(event) => onEditar({ metodoPagamentoId: event.target.value }, 0)}
            className={adminInputClass}
          >
            <option value="" disabled>
              Escolher…
            </option>
            {metodos.map((metodo) => (
              <option key={metodo.id} value={metodo.id}>
                {metodo.nome}
              </option>
            ))}
            {metodoRetirado && (
              <option value={campos.metodoPagamentoId}>
                {linha.base?.metodoPagamentoNome ?? "Método"} (desativado)
              </option>
            )}
          </select>
        </AdminField>
      </div>

      {estado === "erro" && linha.mensagem && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-rose-500">
            {linha.mensagem}
          </p>
          {!linha.errors && (
            <button type="button" onClick={onTentar} className="btn-admin-ghost min-h-9 text-xs">
              Tentar de novo
            </button>
          )}
        </div>
      )}

      {estado === "conflito" && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-a-text">
          <p className="font-semibold">{linha.mensagem}</p>
          {linha.atual && (
            <p className="mt-1 text-a-muted">
              Versão guardada: {ROTULO_TIPO[linha.atual.tipo]} · &quot;{linha.atual.descricao}&quot; ·{" "}
              {formatCentimos(linha.atual.valorCentimos)} · {linha.atual.metodoPagamentoNome}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onUsarGuardada} className="btn-admin-ghost min-h-9 text-xs">
              {linha.atual ? "Usar a versão guardada" : "Descartar esta linha"}
            </button>
            <button
              type="button"
              onClick={onManterMinha}
              disabled={bloqueada}
              className="btn-admin min-h-9 text-xs"
            >
              {linha.atual ? "Manter a minha" : "Guardar de novo"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
