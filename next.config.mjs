/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      // The epolPTA/ DBF snapshot tree contains thousands of files. Watching it
      // exhausts the OS file-descriptor limit (EMFILE), so exclude it. data/ is
      // kept watched so regenerated JSON hot-reloads after an export.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.next/**", "**/epolPTA/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
