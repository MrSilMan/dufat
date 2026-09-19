"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { IconPlus } from "@/components/admin/icons";
import { CartoesTotais, TabelaPorMetodo } from "@/components/relatorios/ResumoRelatorio";
import { ImportarFactura } from "@/components/relatorios/ImportarFactura";
import { RegistoEditor, totalDoRegistoEmEdicao } from "@/components/relatorios/RegistoEditor";
import {
  apagarRegisto,
  consultarVersaoRelatorio,
  finalizarRelatorio,
  guardarRegisto,
  type ResultadoRegisto,
} from "@/server/actions/relatorios";
import {
  centimosParaTexto,
  descontoParaTexto,
  formatCentimos,
  quantidadeMilParaTexto,
} from "@/lib/relatorios/dinheiro";
import {
  ROTULO_TIPO,
  calcularTotais,
  type RegistoVista,
  type TipoLinha,
} from "@/lib/relatorios/resumo";
import type { FacturaCarregada } from "@/lib/relatorios/catalogo";
import {
  TIPOS,
  calcularEmEdicao,
  camposDe,
  completo,
  iguais,
  linhaVazia,
  novoId,
  paraEnviar,
  registoVazio,
  vazio,
  type CamposLinha,
  type CamposRegisto,
  type EstadoRegisto,
  type Metodo,
  type Registo,
} from "@/components/relatorios/tiposEditor";

/** Debounce while typing; a blur or a pick saves at once. */
const ATRASO_ESCRITA = 800;
const ATRASO_RELIGAR = 5000;

// ---------- Local backup ----------
//
// Each record saves itself to the server as soon as it is complete, but one
// still being filled in — or one whose save could not get through — only exists
// in this tab. Mirroring those to localStorage means a closed browser or a
// phone that discards the tab loses nothing: the next visit restores them.
//
// localStorage is shared by every tab, so each entry names the tab that owns
// it and when that tab last confirmed it. A tab only restores its own entries
// (after a reload) or ones whose owner has gone quiet — never the half-typed
// record of a tab that is still open next to it.

type Pendente = {
  campos: CamposRegisto;
  baseVersao: number | null;
  /** The report's version when this was written; a mismatch means it changed since. */
  versaoRelatorio: number;
  dono: string;
  visto: number;
};

const chaveBackup = (relatorioId: string) => `dufat:relatorio:${relatorioId}:registos`;

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

const eTexto = (valor: unknown): valor is string => typeof valor === "string";

/**
 * A backup entry is whatever the last visit left in localStorage — possibly
 * written by an older version of this screen, or by hand. It is only restored
 * once every field is the shape the editor expects.
 */
function validarCampos(valor: unknown): CamposRegisto | null {
  if (!valor || typeof valor !== "object") return null;
  const c = valor as Partial<CamposRegisto>;
  if (
    !TIPOS.includes(c.tipo as TipoLinha) ||
    !eTexto(c.clienteNome) ||
    !eTexto(c.clienteNif) ||
    !eTexto(c.clienteInvgestId) ||
    !eTexto(c.facturaInvgestId) ||
    !eTexto(c.facturaCodigo) ||
    !eTexto(c.nota) ||
    !eTexto(c.metodoPagamentoId) ||
    !Array.isArray(c.linhas) ||
    c.linhas.length === 0
  ) {
    return null;
  }

  const linhas: CamposLinha[] = [];
  for (const bruta of c.linhas) {
    const l = bruta as Partial<CamposLinha> | null;
    if (
      !l ||
      !eTexto(l.id) ||
      !eTexto(l.descricao) ||
      !eTexto(l.quantidade) ||
      !eTexto(l.precoUnitario) ||
      !eTexto(l.artigoInvgestId) ||
      !eTexto(l.artigoCodigo)
    ) {
      return null;
    }
    // A backup written before lines carried an IVA rate has none, and one
    // written before the inclusive/taxable choice existed priced its lines as
    // paid — a rate of 0 either way, which is what those fields default to.
    // One written before discounts existed had none.
    linhas.push({
      ...(l as CamposLinha),
      taxaIva: typeof l.taxaIva === "number" && l.taxaIva > 0 ? Math.round(l.taxaIva) : 0,
      precoIncluiIva: l.precoIncluiIva === true,
      desconto: eTexto(l.desconto) ? l.desconto : "",
    });
  }
  return { ...(c as CamposRegisto), desconto: eTexto(c.desconto) ? c.desconto : "", linhas };
}

function lerPendentes(relatorioId: string): Record<string, Pendente> {
  try {
    const bruto = window.localStorage.getItem(chaveBackup(relatorioId));
    const valor: unknown = bruto ? JSON.parse(bruto) : null;
    if (!valor || typeof valor !== "object") return {};
    const pendentes: Record<string, Pendente> = {};
    for (const [id, entrada] of Object.entries(valor as Record<string, unknown>)) {
      const p = entrada as Partial<Pendente> | null;
      const campos = validarCampos(p?.campos);
      if (
        p &&
        campos &&
        (p.baseVersao === null || typeof p.baseVersao === "number") &&
        typeof p.versaoRelatorio === "number" &&
        typeof p.dono === "string" &&
        typeof p.visto === "number"
      ) {
        pendentes[id] = { ...(p as Pendente), campos };
      }
    }
    return pendentes;
  } catch {
    return {};
  }
}

/**
 * Replaces this tab's entries with its current unsaved records, leaving other
 * tabs' entries alone. `libertar` drops entries this tab has just taken over.
 */
function gravarPendentes(
  relatorioId: string,
  registos: readonly Registo[],
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
    for (const registo of registos) {
      if (registo.estado === "guardado") continue;
      if (!registo.base && vazio(registo.campos)) continue;
      mapa[registo.id] = {
        campos: registo.campos,
        baseVersao: registo.base?.versao ?? null,
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

const temPorGuardar = (registos: readonly Registo[]) =>
  registos.some((r) => r.estado !== "guardado" && !(r.base === null && vazio(r.campos)));

type Props = {
  relatorioId: string;
  versao: number;
  registos: RegistoVista[];
  /** Active methods only; a record on a retired method still shows its name. */
  metodos: Metodo[];
};

/**
 * The draft report, edited in place.
 *
 * Every record saves itself: shortly after typing stops, on blur, or right
 * after a pick. The server is the record; this component keeps just enough
 * state to say what is saved, to retry what is not, and to surface — rather
 * than overwrite — changes made in another tab.
 */
export function EditorRelatorio({
  relatorioId,
  versao,
  registos: registosServidor,
  metodos,
}: Props) {
  const router = useRouter();

  const [registos, setRegistos] = useState<Registo[]>(() =>
    registosServidor.map((registo) => ({
      id: registo.id,
      base: registo,
      campos: camposDe(registo),
      estado: "guardado" as const,
    })),
  );
  // Saves resolve long after the render that started them; they read and write
  // through this ref so they never act on a stale copy of the records.
  const registosRef = useRef(registos);
  const versaoRef = useRef(versao);
  const emVoo = useRef(new Set<string>());
  const repetir = useRef(new Set<string>());
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const guardarRef = useRef<(id: string) => Promise<void>>(async () => {});
  const donoRef = useRef<string | null>(null);
  /** Set once the server refuses writes: edits made since are not worth keeping. */
  const descartarBackup = useRef(false);

  const dono = () => (donoRef.current ??= idDoSeparador());

  // Which records are open. A day is a long list of finished records and one
  // being written: only the one in hand is worth the whole form, so a record
  // opens when it is created (or when someone asks for it) and closes again
  // as soon as the next one starts.
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(() => new Set<string>());

  const [fechado, setFechado] = useState<string | null>(null);
  const [aApagar, setAApagar] = useState<string | null>(null);
  const [aFinalizar, setAFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [avisoFinalizar, setAvisoFinalizar] = useState<string | null>(null);

  function atualizar(fn: (atuais: Registo[]) => Registo[]) {
    const proximos = fn(registosRef.current);
    registosRef.current = proximos;
    setRegistos(proximos);
  }

  function mudarRegisto(id: string, patch: Partial<Registo>) {
    atualizar((atuais) => atuais.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
    const registo = registosRef.current.find((r) => r.id === id);
    if (!registo || registo.estado === "conflito") return;

    if (registo.base && iguais(registo.campos, registo.base)) {
      if (registo.estado !== "guardado") {
        mudarRegisto(id, {
          estado: "guardado",
          mensagem: undefined,
          errors: undefined,
        });
      }
      return;
    }
    if (!registo.base && vazio(registo.campos)) {
      mudarRegisto(id, { estado: "novo" });
      return;
    }
    if (!completo(registo.campos)) {
      mudarRegisto(id, { estado: "incompleto", mensagem: undefined });
      return;
    }
    // One save per record at a time, so versions are always based on the last
    // confirmed copy; an edit made meanwhile goes out when this one returns.
    if (emVoo.current.has(id)) {
      repetir.current.add(id);
      return;
    }

    emVoo.current.add(id);
    const enviados = registo.campos;
    mudarRegisto(id, {
      estado: "a_guardar",
      mensagem: undefined,
      errors: undefined,
    });

    let resultado: ResultadoRegisto;
    try {
      resultado = await guardarRegisto({
        relatorioId,
        id,
        versao: registo.base?.versao ?? null,
        ...paraEnviar(enviados),
      });
    } catch {
      emVoo.current.delete(id);
      repetir.current.delete(id);
      mudarRegisto(id, { estado: "sem_ligacao" });
      agendar(id, ATRASO_RELIGAR);
      return;
    }
    emVoo.current.delete(id);

    const atual = registosRef.current.find((r) => r.id === id);
    if (!atual) return;

    if (resultado.ok) {
      versaoRef.current = Math.max(versaoRef.current, resultado.versaoRelatorio);
      const mudou = atual.campos !== enviados;
      mudarRegisto(id, {
        base: resultado.registo,
        estado: mudou ? "por_guardar" : "guardado",
      });
      if (repetir.current.delete(id) || mudou) agendar(id, 0);
      return;
    }

    repetir.current.delete(id);
    switch (resultado.codigo) {
      case "CONFLITO":
        mudarRegisto(id, {
          estado: "conflito",
          atual: resultado.atual,
          mensagem: resultado.message,
        });
        break;
      case "VALIDACAO":
        mudarRegisto(id, {
          estado: "erro",
          mensagem: resultado.message,
          errors: resultado.errors,
        });
        break;
      case "FECHADO":
      case "SEM_ACESSO":
        fecharEditor(resultado.message);
        break;
      default:
        mudarRegisto(id, { estado: "erro", mensagem: resultado.message });
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

  /** Clears the errors for the fields this edit touched, and reschedules. */
  function aplicar(
    id: string,
    mudar: (campos: CamposRegisto) => CamposRegisto,
    chavesLimpas: string[],
    atraso: number,
  ) {
    atualizar((atuais) =>
      atuais.map((r) => {
        if (r.id !== id) return r;
        const errors = r.errors ? { ...r.errors } : undefined;
        if (errors) for (const chave of chavesLimpas) delete errors[chave];
        const estado: EstadoRegisto =
          r.estado === "conflito" || r.estado === "a_guardar" ? r.estado : "por_guardar";
        return { ...r, campos: mudar(r.campos), estado, errors };
      }),
    );
    agendar(id, atraso);
  }

  function editar(id: string, patch: Partial<CamposRegisto>, atraso = ATRASO_ESCRITA) {
    aplicar(id, (campos) => ({ ...campos, ...patch }), Object.keys(patch), atraso);
  }

  function editarLinha(
    id: string,
    linhaId: string,
    patch: Partial<CamposLinha>,
    atraso = ATRASO_ESCRITA,
  ) {
    aplicar(
      id,
      (campos) => ({
        ...campos,
        linhas: campos.linhas.map((linha) =>
          linha.id === linhaId ? { ...linha, ...patch } : linha,
        ),
      }),
      Object.keys(patch).map((campo) => `linhas.${linhaId}.${campo}`),
      atraso,
    );
  }

  function adicionarLinha(id: string) {
    const nova = linhaVazia();
    aplicar(id, (campos) => ({ ...campos, linhas: [...campos.linhas, nova] }), [], ATRASO_ESCRITA);
    focar(`descricao-${nova.id}`);
  }

  function removerLinha(id: string, linhaId: string) {
    const registo = registosRef.current.find((r) => r.id === id);
    // A record is at least one article; the card disables the button too.
    if (!registo || registo.campos.linhas.length <= 1) return;
    aplicar(
      id,
      (campos) => ({
        ...campos,
        linhas: campos.linhas.filter((linha) => linha.id !== linhaId),
      }),
      [],
      0,
    );
  }

  function focar(id: string) {
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  /**
   * A record whose save was refused stays open: its message and the choice it
   * asks for are the reason the day cannot be finalized yet.
   */
  const porDecidir = (registo: Registo) =>
    registo.estado === "erro" || registo.estado === "conflito";

  function alternar(id: string) {
    setAbertos((atuais) => {
      const proximos = new Set(atuais);
      if (!proximos.delete(id)) proximos.add(id);
      return proximos;
    });
  }

  function acrescentar(campos: CamposRegisto): string {
    const id = novoId();
    atualizar((atuais) => [...atuais, { id, base: null, campos, estado: "novo" }]);
    // Starting a record closes the ones before it: the new card is then the
    // first thing under the buttons, with no scrolling to reach it.
    setAbertos(new Set([id]));
    return id;
  }

  function adicionar(tipo: TipoLinha) {
    const campos = registoVazio(tipo, metodos.length === 1 ? metodos[0]!.id : "");
    acrescentar(campos);
    focar(`descricao-${campos.linhas[0]!.id}`);
  }

  /**
   * A record filled in from an INVGEST document. Everything it brings is
   * editable — the picker is a shortcut past the typing, not a lock.
   */
  function importarFactura(factura: FacturaCarregada) {
    const campos: CamposRegisto = {
      tipo: "VENDA",
      clienteNome: factura.clienteNome ?? "",
      clienteNif: factura.clienteNif ?? "",
      clienteInvgestId: factura.clienteInvgestId ?? "",
      facturaInvgestId: factura.invgestId,
      facturaCodigo: factura.codigo,
      nota: "",
      desconto: "",
      metodoPagamentoId: metodos.length === 1 ? metodos[0]!.id : "",
      linhas: factura.linhas.map((linha) => ({
        id: novoId(),
        descricao: linha.descricao,
        quantidade: quantidadeMilParaTexto(linha.quantidadeMil),
        precoUnitario: centimosParaTexto(linha.precoUnitarioCentimos),
        taxaIva: linha.taxaIvaCentesimos,
        // A document states a taxable price; the tax goes on top of it.
        precoIncluiIva: false,
        desconto: descontoParaTexto(linha.desconto),
        artigoInvgestId: linha.artigoInvgestId ?? "",
        artigoCodigo: linha.artigoCodigo ?? "",
      })),
    };
    const id = acrescentar(campos);
    // A document carries no payment method: that is the one thing still to
    // choose, so the card is brought into view with it focused.
    focar(campos.metodoPagamentoId ? `registo-${id}` : `metodo-${id}`);
    if (campos.metodoPagamentoId) agendar(id, 0);
  }

  function remover(id: string) {
    const temporizador = temporizadores.current.get(id);
    if (temporizador) clearTimeout(temporizador);
    temporizadores.current.delete(id);
    atualizar((atuais) => atuais.filter((r) => r.id !== id));
  }

  function pedirApagar(id: string) {
    const registo = registosRef.current.find((r) => r.id === id);
    if (!registo) return;
    // Never reached the server: nothing to delete there, nothing to confirm.
    if (!registo.base && registo.estado !== "conflito") {
      remover(id);
      return;
    }
    setAApagar(id);
  }

  async function confirmarApagar() {
    const id = aApagar;
    setAApagar(null);
    const registo = registosRef.current.find((r) => r.id === id);
    if (!id || !registo) return;
    if (!registo.base) {
      remover(id);
      return;
    }

    const temporizador = temporizadores.current.get(id);
    if (temporizador) clearTimeout(temporizador);
    mudarRegisto(id, { estado: "a_guardar", mensagem: undefined });

    try {
      const resultado = await apagarRegisto({
        relatorioId,
        id,
        versao: registo.base.versao,
      });
      if (resultado.ok) {
        versaoRef.current = Math.max(versaoRef.current, resultado.versaoRelatorio);
        remover(id);
      } else if (resultado.codigo === "CONFLITO") {
        mudarRegisto(id, {
          estado: "conflito",
          atual: resultado.atual,
          mensagem: resultado.message,
        });
      } else if (resultado.codigo === "FECHADO" || resultado.codigo === "SEM_ACESSO") {
        fecharEditor(resultado.message);
      } else {
        mudarRegisto(id, { estado: "erro", mensagem: resultado.message });
      }
    } catch {
      mudarRegisto(id, {
        estado: "erro",
        mensagem: "Sem ligação — o registo não foi apagado. Tente de novo.",
      });
    }
  }

  function usarGuardado(id: string) {
    const registo = registosRef.current.find((r) => r.id === id);
    if (!registo) return;
    if (!registo.atual) {
      remover(id);
      return;
    }
    mudarRegisto(id, {
      base: registo.atual,
      campos: camposDe(registo.atual),
      estado: "guardado",
      atual: undefined,
      mensagem: undefined,
      errors: undefined,
    });
  }

  function manterMeu(id: string) {
    const registo = registosRef.current.find((r) => r.id === id);
    if (!registo) return;
    // Based on the server's copy now, so the save is an informed overwrite —
    // or, for a record deleted elsewhere, a deliberate re-creation.
    mudarRegisto(id, {
      base: registo.atual ?? null,
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

    const doServidor = new Map(registosServidor.map((r) => [r.id, r]));
    const aGuardar: string[] = [];

    atualizar((atuais) => {
      const porId = new Map(atuais.map((r) => [r.id, r]));
      const extra: Registo[] = [];

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
            porId.set(id, {
              ...local,
              campos: pendente.campos,
              estado: "por_guardar",
              recuperado: true,
            });
            aGuardar.push(id);
          } else {
            porId.set(id, {
              ...local,
              campos: pendente.campos,
              estado: "conflito",
              atual: servidor,
              recuperado: true,
              mensagem:
                "Recuperámos alterações por guardar, mas o relatório foi alterado entretanto.",
            });
          }
        } else if (!porId.has(id) && !vazio(pendente.campos)) {
          if (!mudou && pendente.baseVersao === null) {
            extra.push({
              id,
              base: null,
              campos: pendente.campos,
              estado: "por_guardar",
              recuperado: true,
            });
            aGuardar.push(id);
          } else {
            extra.push({
              id,
              base: null,
              campos: pendente.campos,
              estado: "conflito",
              atual: null,
              recuperado: true,
              mensagem:
                pendente.baseVersao === null
                  ? "Recuperámos um registo por guardar, mas o relatório foi alterado entretanto."
                  : "Recuperámos alterações por guardar de um registo entretanto apagado.",
            });
          }
        }
      }

      return [...atuais.map((r) => porId.get(r.id)!), ...extra];
    });

    // Take the restored entries over from the tab that left them, so no other
    // tab restores them a second time.
    gravarPendentes(
      relatorioId,
      registosRef.current,
      dono(),
      versaoRef.current,
      candidatos.map(([id]) => id),
    );
    for (const id of aGuardar) agendar(id, 0);
    // Whatever came back from the backup is what this visit has to look at.
    setAbertos(new Set(registosRef.current.filter((r) => r.recuperado).map((r) => r.id)));
    // Mount only: this reads the backup once, against the records first rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fresh server data (after a refresh): take what changed elsewhere, keep what
  // is being edited here, and flag the records where both happened.
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

    const doServidor = new Map(registosServidor.map((r) => [r.id, r]));
    atualizar((atuais) => {
      const vistos = new Set<string>();
      const resultado: Registo[] = [];

      for (const local of atuais) {
        vistos.add(local.id);
        const servidor = doServidor.get(local.id);
        const ocupado = emVoo.current.has(local.id);

        if (servidor) {
          if ((local.base && local.base.versao >= servidor.versao) || ocupado) {
            resultado.push(local);
          } else if (local.estado === "guardado") {
            resultado.push({
              id: local.id,
              base: servidor,
              campos: camposDe(servidor),
              estado: "guardado",
            });
          } else if (!local.base) {
            resultado.push(local);
          } else {
            resultado.push({
              ...local,
              estado: "conflito",
              atual: servidor,
              mensagem: "Este registo foi alterado noutra janela.",
            });
          }
        } else if (!local.base || ocupado) {
          resultado.push(local);
        } else if (local.estado !== "guardado") {
          resultado.push({
            ...local,
            estado: "conflito",
            atual: null,
            mensagem: "Este registo foi apagado noutra janela.",
          });
        }
        // A clean record missing from the server was deleted elsewhere: dropped.
      }

      for (const servidor of registosServidor) {
        if (!vistos.has(servidor.id)) {
          resultado.push({
            id: servidor.id,
            base: servidor,
            campos: camposDe(servidor),
            estado: "guardado",
          });
        }
      }
      return resultado;
    });
  }, [registosServidor, versao]);

  useEffect(() => {
    const gravar = () => {
      if (!descartarBackup.current) {
        gravarPendentes(relatorioId, registosRef.current, dono(), versaoRef.current);
      }
    };
    gravar();
    if (!temPorGuardar(registos)) return;
    // Keeps this tab's entries fresh so other tabs leave them alone.
    const batimento = setInterval(gravar, BATIMENTO);
    return () => clearInterval(batimento);
  }, [relatorioId, registos]);

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
      for (const registo of registosRef.current) {
        if (registo.estado === "sem_ligacao") agendar(registo.id, 0);
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
      const porGuardar = registosRef.current.some((r) =>
        ["por_guardar", "a_guardar", "sem_ligacao"].includes(r.estado),
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
      const resultado = await finalizarRelatorio({
        id: relatorioId,
        versao: versaoRef.current,
      });
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
      } else if (resultado.codigo === "CONFLITO") router.refresh();
    } catch {
      setAvisoFinalizar("Sem ligação — o relatório não foi finalizado. Tente de novo.");
    }
    setFinalizando(false);
  }

  // ---------- Derived ----------

  const nomes = new Map(metodos.map((m) => [m.id, m.nome]));

  // Live totals, including records still being typed: the same sums the server
  // will arrive at, computed from the same parsers.
  const totais = calcularTotais(
    registos.flatMap((registo) => {
      if (!registo.campos.metodoPagamentoId) return [];
      const metodoPagamentoNome =
        registo.base && registo.base.metodoPagamentoId === registo.campos.metodoPagamentoId
          ? registo.base.metodoPagamentoNome
          : (nomes.get(registo.campos.metodoPagamentoId) ?? "—");

      return calcularEmEdicao(registo.campos).linhas.map(({ calculo, precos }) => ({
        ...calculo,
        tipo: registo.campos.tipo,
        metodoPagamentoNome,
        descontoCentimos: precos.descontoLinha,
        descontoRegistoCentimos: precos.descontoRegisto,
        valorCentimos: precos.total,
      }));
    }),
  );

  const porResolver = registos.filter((r) => r.estado !== "guardado" && r.estado !== "novo");
  const aGuardar = registos.some((r) => r.estado === "a_guardar" || r.estado === "por_guardar");
  const semLigacao = registos.some((r) => r.estado === "sem_ligacao");
  const podeFinalizar = !fechado && !finalizando && porResolver.length === 0;
  const semMetodos = metodos.length === 0;

  const estadoGeral = semLigacao
    ? {
        texto: "Sem ligação — as alterações ficam neste dispositivo e são enviadas ao religar.",
        cor: "text-amber-600",
      }
    : aGuardar
      ? { texto: "A guardar…", cor: "text-a-muted" }
      : porResolver.length > 0
        ? {
            texto: `${porResolver.length} registo(s) por resolver.`,
            cor: "text-amber-600",
          }
        : { texto: "Todas as alterações guardadas.", cor: "text-emerald-600" };

  const registoAApagar = registos.find((r) => r.id === aApagar);
  const recuperados = registos.filter((r) => r.recuperado).length;

  // Newest first: the record just started sits right under the buttons that
  // started it, and the day's older ones fall away below. The number stays the
  // one the record was created with.
  const emOrdem = registos.map((registo, indice) => ({ registo, numero: indice + 1 })).reverse();
  const algumAberto = registos.some((r) => abertos.has(r.id));

  return (
    <div className="space-y-6">
      {fechado && (
        <p role="alert" className="card-admin border-rose-500/40 p-4 text-sm text-a-text">
          {fechado}
        </p>
      )}

      {recuperados > 0 && (
        <p role="status" className="card-admin border-lumen/40 p-4 text-sm text-a-text">
          Recuperámos {recuperados} registo(s) que ficaram por guardar na última visita.
        </p>
      )}

      {semMetodos && (
        <p className="card-admin border-lumen/40 p-4 text-sm text-a-text">
          Ainda não há métodos de pagamento disponíveis. Peça ao administrador para os criar antes
          de registar vendas ou despesas.
        </p>
      )}

      {/* The day's figures first, then the buttons that change them, then the
          records themselves — so adding the next one is always the top of the
          page, not the end of a list that grows all day. */}
      <CartoesTotais
        totais={totais}
        nota={porResolver.length > 0 ? "Os totais incluem registos ainda por guardar." : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className={cn("text-sm", estadoGeral.cor)}>
          {estadoGeral.texto}
        </p>
        <div className="flex flex-wrap gap-2">
          <ImportarFactura
            disabled={semMetodos || Boolean(fechado)}
            onImportada={importarFactura}
          />
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => adicionar(tipo)}
              disabled={semMetodos || Boolean(fechado)}
              className={cn(tipo === "VENDA" ? "btn-admin" : "btn-admin-ghost", "min-h-11")}
            >
              <IconPlus className="h-4 w-4" />
              {ROTULO_TIPO[tipo]}
            </button>
          ))}
        </div>
      </div>

      {registos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-a-line-strong p-10 text-center">
          <p className="font-semibold text-a-text">Ainda sem registos.</p>
          <p className="mt-1 text-sm text-a-muted">
            Cada venda ou despesa é um registo: o cliente, o pagamento e os artigos que o compõem.
            Tudo é guardado automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-a-faint">
              {registos.length} registo(s) · mais recentes primeiro
            </h2>
            {registos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setAbertos(algumAberto ? new Set() : new Set(registos.map((r) => r.id)))
                }
                className="min-h-9 text-xs font-medium text-a-muted underline-offset-2 transition-colors hover:text-a-text hover:underline"
              >
                {algumAberto ? "Fechar todos" : "Abrir todos"}
              </button>
            )}
          </div>

          <ul className="space-y-3">
            {emOrdem.map(({ registo, numero }) => (
              <RegistoEditor
                key={registo.id}
                registo={registo}
                numero={numero}
                metodos={metodos}
                nomes={nomes}
                bloqueado={Boolean(fechado)}
                aberto={abertos.has(registo.id) || porDecidir(registo)}
                fixo={porDecidir(registo)}
                onAlternar={() => alternar(registo.id)}
                onEditar={(patch, atraso) => editar(registo.id, patch, atraso)}
                onEditarLinha={(linhaId, patch, atraso) =>
                  editarLinha(registo.id, linhaId, patch, atraso)
                }
                onAdicionarLinha={() => adicionarLinha(registo.id)}
                onRemoverLinha={(linhaId) => removerLinha(registo.id, linhaId)}
                onBlur={() => agendar(registo.id, 0)}
                onApagar={() => pedirApagar(registo.id)}
                onTentar={() => {
                  mudarRegisto(registo.id, {
                    estado: "por_guardar",
                    mensagem: undefined,
                  });
                  agendar(registo.id, 0);
                }}
                onUsarGuardado={() => usarGuardado(registo.id)}
                onManterMeu={() => manterMeu(registo.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <TabelaPorMetodo totais={totais} />

      <div className="card-admin flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="min-w-0 text-sm text-a-muted">
          {avisoFinalizar ? (
            <span role="alert" className="text-rose-500">
              {avisoFinalizar}
            </span>
          ) : porResolver.length > 0 ? (
            "Guarde ou resolva todos os registos antes de finalizar."
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
        confirmLabel="Apagar registo"
        message={
          registoAApagar
            ? `Apagar este registo${registoAApagar.campos.clienteNome ? ` de ${registoAApagar.campos.clienteNome}` : ""}?\n\n${registoAApagar.campos.linhas.length} artigo(s) · ${formatCentimos(totalDoRegistoEmEdicao(registoAApagar.campos))}\n\nFica registado no histórico do relatório.`
            : "Apagar este registo?\n\nFica registado no histórico do relatório."
        }
        onCancel={() => setAApagar(null)}
        onConfirm={() => void confirmarApagar()}
      />
    </div>
  );
}
