import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthClient = { name?: string; client_name?: string; redirect_uri?: string };
type AuthorizationDetails = {
  client?: OAuthClient;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};

type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  head: () => ({
    meta: [
      { title: "Authorize Agent Access — DJ Set Recorder" },
      { name: "description", content: "Review and authorize an agent connection to DJ Set Recorder tools." },
      { property: "og:title", content: "Authorize Agent Access — DJ Set Recorder" },
      { property: "og:description", content: "Review and authorize an agent connection to DJ Set Recorder tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth",
        search: { next: location.pathname + location.searchStr },
      });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold">This connection request could not be loaded</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const scopes = (details?.scope ?? "").split(" ").filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: decisionError } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect was returned. Close this window and try again.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Connect {clientName} to DJ Set Recorder
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This lets {clientName} use this app's tools as you.
      </p>

      {details?.client?.redirect_uri ? (
        <p className="mt-4 break-all text-xs text-muted-foreground">
          Returns to: {details.client.redirect_uri}
        </p>
      ) : null}

      {scopes.length > 0 ? (
        <ul className="mt-6 space-y-1 text-sm">
          {scopes.map((scope) => (
            <li key={scope}>
              {scope === "email"
                ? "Share your email address"
                : scope === "profile"
                  ? "Share your basic profile"
                  : scope === "openid"
                    ? "Confirm who you are"
                    : `Additional permission requested: ${scope}`}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Your recordings and library stay on your own computer. This does not give
        anyone access to your files.
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        <Button disabled={busy} onClick={() => void decide(true)}>
          Approve
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>
          Cancel connection
        </Button>
      </div>
    </main>
  );
}
