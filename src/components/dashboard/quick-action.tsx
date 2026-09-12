import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QuickAppointment({ tenantSlug, className }: { tenantSlug: string; className?: string }) {
  return <Button asChild className={className}><Link href={`/barbearia/${tenantSlug}/agendar`}><Plus data-icon="inline-start" /> Novo agendamento</Link></Button>;
}
