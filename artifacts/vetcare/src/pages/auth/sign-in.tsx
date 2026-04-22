import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">VétoAI</h1>
        <p className="text-muted-foreground mt-2">Connectez-vous à votre espace clinique</p>
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <footer className="mt-8 flex items-center gap-3 text-xs text-muted-foreground">
        <a href="/legal" className="hover:text-foreground hover:underline">Mentions légales</a>
        <span>·</span>
        <a href="/confidentialite" className="hover:text-foreground hover:underline">Confidentialité</a>
      </footer>
    </div>
  );
}