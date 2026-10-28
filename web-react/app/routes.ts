import { type RouteConfig, index, route } from "@react-router/dev/routes";

const isDev =
  process.env.NODE_ENV === "development" || process.argv.includes("dev");

export default [
  index("routes/home.tsx"),
  route("docs/*", "routes/docs.tsx"),
  ...(!isDev ? [route("storybook", "routes/storybook.tsx")] : []),
] satisfies RouteConfig;
