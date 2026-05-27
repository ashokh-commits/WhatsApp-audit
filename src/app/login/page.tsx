import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-g6-bg px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          {/* G6-White.png logo — replace src when file is added to /public */}
          {/* <img src="/G6-White.png" alt="G6 Labs" className="mx-auto h-10 object-contain" /> */}
          <div className="mx-auto mb-4 flex h-12 w-32 items-center justify-center rounded border border-g6-border bg-g6-card text-sm text-gray-500">
            {/* Logo placeholder — add /public/G6-White.png to replace */}
            G6 Labs
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            WhatsApp Audit
          </h1>
          <p className="mt-1 text-sm text-gray-400 font-body">
            Agency login — internal access only
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-gray-600 font-body">
          Build smarter. Scale faster.
        </p>
      </div>
    </main>
  );
}
