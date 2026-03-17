import { redirect } from "next/navigation";
import HostPageImpl from "./page.client";

export default async function HostPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string; rt?: string }>;
}) {
  const { at, rt } = await searchParams;

  if (!at || !rt) redirect("/");

  const serverUrl = process.env.LIVEKIT_WS_URL!
    .replace("wss://", "https://")
    .replace("ws://", "http://");

  return <HostPageImpl authToken={at} roomToken={rt} serverUrl={serverUrl} />;
}
