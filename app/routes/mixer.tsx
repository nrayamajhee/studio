import { redirect } from "react-router";
import type { Route } from "./+types/mixer";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Studio - Music Production DAW" },
  ];
}

export function clientLoader() {
  return redirect("/studio");
}

export default function MixerRedirect() {
  return null;
}
