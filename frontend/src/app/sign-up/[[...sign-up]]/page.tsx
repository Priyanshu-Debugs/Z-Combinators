import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex-1 min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md flex flex-col items-center space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="font-heading font-medium text-lg text-text-primary tracking-tight hover:opacity-80 transition"
          >
            Z-Combinators
          </Link>
          <h1 className="text-2xl font-bold font-heading text-text-primary">
            Create Your Account
          </h1>
          <p className="text-xs text-text-secondary">
            Get instant access to AI startup advising and framework-grounded feedback.
          </p>
        </div>

        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/evaluate"
        />
      </div>
    </div>
  );
}
