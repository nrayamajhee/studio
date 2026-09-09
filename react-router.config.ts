import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  basename: process.env.BASE_PATH || "/",
  async prerender({ getStaticPaths }) {
    return [...getStaticPaths(), "/studio"];
  },
} satisfies Config;
