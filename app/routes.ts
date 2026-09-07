import { type RouteConfig, index, route } from "@react-router/dev/routes";

const isDev =
  process.env.NODE_ENV === "development" || process.argv.includes("dev");

export default [
  index("routes/home.tsx"),
  route("mixer", "routes/mixer.tsx"),
  route("instrument/:instrumentId?", "routes/instrument.tsx"),
  ...(!isDev ? [route("storybook", "routes/storybook.tsx")] : []),
] satisfies RouteConfig;
