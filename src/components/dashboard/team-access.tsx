"use client";

import { useActionState } from "react";
import { Mail, RotateCw, UserPlus, X } from "lucide-react";

import { cancelInvitationAction, inviteTeamMemberAction, resendInvitationAction, type InviteActionState } from "@/app/(dashboard)/equipe/actions";
import { invitableRoles } from "@/domain/team/invitations";
import type { Role } from "@/domain/auth/permissions";
import { StaffAvatar } from "@/components/staff-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const roleLabels: Record<Role, string> = { OWNER: "Dono", ADMIN: "Admin", MANAGER: "Gerente", RECEPTIONIST: "Recepção", PROFESSIONAL: "Profissional", CUSTOMER: "Cliente" };
const initialState: InviteActionState = { status: "idle" };

export type TeamAccessData = {
  members: { id: string; name: string; email: string; role: Role; isActive: boolean; imageUrl: string | null }[];
  invitations: { id: string; email: string; role: Role; expiresAt: Date; staffName: string | null; status: "pending" | "expired" | "accepted" }[];
  staffOptions: { id: string; name: string }[];
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function TeamAccess({ data, canInvite }: { data: TeamAccessData; canInvite: boolean }) {
  return (
    <section className="dashboard-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-5 sm:px-6">
        <div><h2 className="font-heading text-xl font-semibold">Acessos da equipe</h2><p className="mt-1 text-xs text-muted-foreground">Quem entra no painel e com qual perfil.</p></div>
        {canInvite ? <InviteDialog staffOptions={data.staffOptions} /> : null}
      </div>
      <ul className="divide-y divide-white/8 px-5 sm:px-6">
        {data.members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 py-3.5">
            <StaffAvatar imageUrl={member.imageUrl} initials={initials(member.name || member.email)} className="size-9" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.name || member.email}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div>
            <Badge variant={member.isActive ? "secondary" : "outline"}>{roleLabels[member.role]}{member.isActive ? "" : " · inativo"}</Badge>
          </li>
        ))}
        {data.invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center gap-3 py-3.5">
            <span className="icon-tile size-9 shrink-0"><Mail className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{invitation.email}</p>
              <p className="text-xs text-muted-foreground">
                {roleLabels[invitation.role]}{invitation.staffName ? ` · ${invitation.staffName}` : ""} · {invitation.status === "expired" ? "convite expirado" : `convite válido até ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(invitation.expiresAt)}`}
              </p>
            </div>
            {canInvite ? <InvitationControls id={invitation.id} /> : null}
          </li>
        ))}
        {!data.members.length && !data.invitations.length ? <li className="py-6 text-sm text-muted-foreground">Ninguém além de você. Convide a equipe para entrar no painel.</li> : null}
      </ul>
    </section>
  );
}

function InvitationControls({ id }: { id: string }) {
  const [resendState, resend, resending] = useActionState(resendInvitationAction, initialState);
  const [, cancel, cancelling] = useActionState(cancelInvitationAction, initialState);
  return (
    <div className="flex items-center gap-1">
      {resendState.message ? <span className={`mr-2 text-xs ${resendState.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{resendState.message}</span> : null}
      <form action={resend}><input type="hidden" name="invitationId" value={id} /><Button type="submit" variant="ghost" size="sm" disabled={resending} aria-label="Reenviar convite"><RotateCw data-icon="inline-start" /> Reenviar</Button></form>
      <form action={cancel}><input type="hidden" name="invitationId" value={id} /><Button type="submit" variant="ghost" size="sm" disabled={cancelling} aria-label="Cancelar convite"><X /></Button></form>
    </div>
  );
}

function InviteDialog({ staffOptions }: { staffOptions: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(inviteTeamMemberAction, initialState);
  return (
    <Dialog>
      <DialogTrigger asChild><Button><UserPlus data-icon="inline-start" /> Convidar</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-heading">Convidar para a equipe</DialogTitle><DialogDescription>A pessoa recebe um e-mail, cria a senha (ou entra com o Google do mesmo e-mail) e já cai nesta barbearia. O convite vale 7 dias.</DialogDescription></DialogHeader>
        <form action={action}>
          <FieldGroup>
            {state.message ? <Alert variant={state.status === "success" ? "default" : "destructive"}><AlertDescription>{state.message}</AlertDescription></Alert> : null}
            <Field><FieldLabel htmlFor="inviteEmail">E-mail</FieldLabel><Input id="inviteEmail" name="email" type="email" required placeholder="nome@exemplo.com" />{state.errors?.email?.[0] ? <p className="text-xs text-destructive">{state.errors.email[0]}</p> : null}</Field>
            <Field>
              <FieldLabel htmlFor="inviteRole">Perfil</FieldLabel>
              <Select name="role" defaultValue="PROFESSIONAL"><SelectTrigger id="inviteRole"><SelectValue placeholder="Escolha" /></SelectTrigger><SelectContent>{invitableRoles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label} — {role.hint}</SelectItem>)}</SelectContent></Select>
              {state.errors?.role?.[0] ? <p className="text-xs text-destructive">{state.errors.role[0]}</p> : null}
            </Field>
            {staffOptions.length ? (
              <Field>
                <FieldLabel htmlFor="inviteStaff">Profissional da agenda (opcional)</FieldLabel>
                <Select name="staffId"><SelectTrigger id="inviteStaff"><SelectValue placeholder="Não vincular" /></SelectTrigger><SelectContent>{staffOptions.map((staff) => <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>)}</SelectContent></Select>
                <FieldDescription>Liga o acesso ao cadastro do profissional, para ele ver a própria agenda.</FieldDescription>
              </Field>
            ) : null}
            <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Enviando..." : "Enviar convite"}</Button></DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
