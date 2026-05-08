/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    SHOPIFY_STORE: process.env.SHOPIFY_STORE,
    SHOPIFY_TOKEN: process.env.SHOPIFY_TOKEN,
  },
};

module.exports = nextConfig;
