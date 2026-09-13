import BusinessPage from "@/app/(public)/barbearia/[slug]/page";
import { business } from "@/data/demo";

// A raiz é a página pública da barbearia — o que o cliente vê. A landing de
// venda do produto saiu em 13/09/2026; a rota /barbearia/[slug] continua
// existindo para outros estabelecimentos. O acesso do dono fica no "Entrar"
// do cabeçalho.
export default function HomePage() {
  return <BusinessPage params={Promise.resolve({ slug: business.slug })} />;
}
