export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-10">
      <div className="absolute left-1/2 top-1/3 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
      {children}
    </main>
  );
}
