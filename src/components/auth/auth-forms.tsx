"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  loginAction,
  recoverAction,
  signupAction,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const initialAuthState: AuthActionState = { status: "idle" };

/* Campo em caixa, como na referência: rótulo pequeno em cima, valor embaixo,
   tudo dentro de um bloco branco. O Input perde borda e fundo próprios — o
   `dark:bg-transparent` é necessário porque o `dark:bg-input/30` do shadcn
   venceria um `bg-transparent` sem variante. */
function FieldBox({ id, label, error, trailing, children }: { id: string; label: string; error?: string[]; trailing?: React.ReactNode; children: React.ReactNode }) {
  const message = error?.[0];
  return (
    <div className={`rounded-2xl bg-white px-4 pb-3 pt-3 shadow-[0_2px_12px_rgb(0_0_0/.05)] ring-1 ${message ? "ring-destructive/50" : "ring-black/5"} focus-within:ring-black/25`}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">{label}</label>
        {trailing}
      </div>
      {children}
      {message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null}
    </div>
  );
}

const boxInput = "h-7 rounded-none border-0 bg-transparent px-0 text-[15px] shadow-none placeholder:text-black/30 focus-visible:ring-0 dark:bg-transparent";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialAuthState);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      {state.message ? <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert> : null}
      <FieldBox id="email" label="E-mail" error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@barbearia.com" required className={boxInput} />
      </FieldBox>
      <FieldBox id="password" label="Senha" error={state.errors?.password} trailing={<Link href="/recuperar-senha" className="text-[11px] text-muted-foreground underline-offset-4 hover:underline">Esqueci a senha</Link>}>
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required className={boxInput} />
      </FieldBox>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</Button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initialAuthState);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      {state.message ? <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert> : null}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FieldBox id="firstName" label="Nome" error={state.errors?.firstName}><Input id="firstName" name="firstName" autoComplete="given-name" required className={boxInput} /></FieldBox>
        <FieldBox id="lastName" label="Sobrenome" error={state.errors?.lastName}><Input id="lastName" name="lastName" autoComplete="family-name" required className={boxInput} /></FieldBox>
      </div>
      <FieldBox id="businessName" label="Nome da barbearia" error={state.errors?.businessName}><Input id="businessName" name="businessName" autoComplete="organization" required className={boxInput} /></FieldBox>
      <FieldBox id="signupEmail" label="E-mail" error={state.errors?.email}><Input id="signupEmail" name="email" type="email" autoComplete="email" required className={boxInput} /></FieldBox>
      <FieldBox id="signupPassword" label="Senha" error={state.errors?.password}><Input id="signupPassword" name="password" type="password" autoComplete="new-password" placeholder="Mín. 8 caracteres, letra e número" required className={boxInput} /></FieldBox>
      <FieldBox id="confirmPassword" label="Confirmar senha" error={state.errors?.confirmPassword}><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={boxInput} /></FieldBox>
      <label htmlFor="terms" className="flex items-start gap-3 px-1 text-xs text-muted-foreground">
        <Checkbox id="terms" name="terms" required className="mt-0.5" />
        <span>Aceito os termos e a política de privacidade.{state.errors?.terms?.[0] ? <span className="block text-destructive">{state.errors.terms[0]}</span> : null}</span>
      </label>
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>{pending ? "Criando..." : "Criar conta"}</Button>
    </form>
  );
}

export function RecoverForm() {
  const [state, action, pending] = useActionState(recoverAction, initialAuthState);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      {state.message ? <Alert><AlertDescription>{state.message}</AlertDescription></Alert> : null}
      <FieldBox id="recoverEmail" label="E-mail" error={state.errors?.email}><Input id="recoverEmail" name="email" type="email" autoComplete="email" placeholder="voce@barbearia.com" required className={boxInput} /></FieldBox>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>{pending ? "Enviando..." : "Enviar link"}</Button>
    </form>
  );
}
