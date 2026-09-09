import { redirect } from "react-router";
import type { Route } from "./+types/instrument";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Studio - Music Production DAW" },
  ];
}

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  return redirect(
    params.instrumentId ? `/studio/${params.instrumentId}` : "/studio",
  );
}

export default function InstrumentRedirect() {
  return null;
}
