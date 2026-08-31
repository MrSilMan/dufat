import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { isMailConfigured } from "@/lib/mail";
import { formatDate } from "@/lib/format";
import { revokeInvite, setUserActive } from "@/server/actions/team";
import {
  ActiveBadge,
  EmptyState,
  InviteStatusBadge,
  PageHeader,
  RoleBadge,
  rowDangerClass,
} from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { InviteForm } from "@/components/admin/InviteForm";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { IconUsers } from "@/components/admin/icons";

export const metadata: Metadata = {
  title: "Contas e acessos",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export default async function AdminTeamPage() {
  const admin = await requireAdminRole();

  const [members, invites, activeAdmins] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
    }),
    prisma.invite.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.user.count({ where: { role: "ADMIN", active: true } }),
  ]);

  const [cargos, departamentos] = await Promise.all([
    prisma.cargo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.departamento.findMany({
      where: { ativo: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contas e acessos"
        description="Convide colegas e faça a gestão das permissões de acesso ao painel."
      />

      <InviteForm
        mailConfigured={isMailConfigured()}
        cargos={cargos}
        departamentos={departamentos}
      />

      {invites.length > 0 && (
        <section aria-labelledby="invites-title">
          <h2 id="invites-title" className="font-display text-lg font-bold text-a-text">
            Convites pendentes
          </h2>
          <div className="card-admin mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <thead>
                  <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                    <th className="px-5 py-3.5 font-semibold">Convidado</th>
                    <th className="px-5 py-3.5 font-semibold">Permissões</th>
                    <th className="px-5 py-3.5 font-semibold">Estado</th>
                    <th className="px-5 py-3.5 font-semibold">Expira</th>
                    <th className="px-5 py-3.5 font-semibold">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="table-rows">
                  {invites.map((invite) => {
                    const expired = invite.expiresAt < new Date();
                    return (
                      <tr key={invite.id}>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-a-text">{invite.name}</p>
                          <p className="font-mono text-xs text-a-faint">{invite.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <RoleBadge role={invite.role} />
                        </td>
                        <td className="px-5 py-3.5">
                          <InviteStatusBadge status={expired ? "REVOKED" : invite.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-mono text-xs text-a-muted">
                            {expired ? "Expirado" : formatDate(invite.expiresAt)}
                          </p>
                          <p className="mt-0.5 text-xs text-a-faint">
                            Enviado por {invite.createdBy.name}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end">
                            <form action={revokeInvite}>
                              <input type="hidden" name="id" value={invite.id} />
                              <DangerSubmit
                                confirmMessage={`Revogar o convite de ${invite.name}? O link deixa de funcionar.`}
                                className={rowDangerClass}
                              >
                                Revogar
                              </DangerSubmit>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="members-title">
        <h2 id="members-title" className="font-display text-lg font-bold text-a-text">
          Membros
        </h2>
        <div className="card-admin mt-4 overflow-hidden">
          {members.length === 0 ? (
            <EmptyState
              icon={<IconUsers className="h-5 w-5" />}
              title="Ainda sem membros"
              description="Convide o primeiro colega para a equipa."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <thead>
                  <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                    <th className="px-5 py-3.5 font-semibold">Membro</th>
                    <th className="px-5 py-3.5 font-semibold">Permissões</th>
                    <th className="px-5 py-3.5 font-semibold">Estado</th>
                    <th className="px-5 py-3.5 font-semibold">Última entrada</th>
                    <th className="px-5 py-3.5 font-semibold">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="table-rows">
                  {members.map((member) => {
                    const isSelf = member.id === admin.sub;
                    // The last active admin must keep both their role and their
                    // access, or nobody can administer the site again.
                    const isLastAdmin = member.role === "ADMIN" && member.active && activeAdmins <= 1;
                    const lockReason = isLastAdmin
                      ? "É o único administrador ativo."
                      : isSelf
                        ? "Não pode alterar a sua própria conta."
                        : undefined;

                    return (
                      <tr key={member.id}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3.5">
                            <span
                              aria-hidden
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-dufat-bright to-dufat text-xs font-bold text-white"
                            >
                              {initials(member.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-a-text">
                                {member.name}
                                {isSelf && (
                                  <span className="ml-2 text-xs font-normal text-a-faint">(você)</span>
                                )}
                              </p>
                              <p className="font-mono text-xs text-a-faint">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <RoleSelect
                              userId={member.id}
                              role={member.role}
                              disabled={isSelf || isLastAdmin}
                              disabledTitle={lockReason}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <ActiveBadge active={member.active} />
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-mono text-xs text-a-muted">
                            {member.lastLoginAt ? formatDate(member.lastLoginAt) : "Nunca entrou"}
                          </p>
                          {member.invitedBy && (
                            <p className="mt-0.5 text-xs text-a-faint">
                              Convidado por {member.invitedBy.name}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end">
                            {isSelf || isLastAdmin ? (
                              <span className="text-xs text-a-faint" title={lockReason}>
                                —
                              </span>
                            ) : member.active ? (
                              <form action={setUserActive}>
                                <input type="hidden" name="id" value={member.id} />
                                <input type="hidden" name="active" value="false" />
                                <DangerSubmit
                                  confirmMessage={`Desativar ${member.name}? Deixa de conseguir entrar, mas o histórico é mantido.`}
                                  className={rowDangerClass}
                                >
                                  Desativar
                                </DangerSubmit>
                              </form>
                            ) : (
                              <form action={setUserActive}>
                                <input type="hidden" name="id" value={member.id} />
                                <input type="hidden" name="active" value="true" />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                                >
                                  Reativar
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
