/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Turbopackの設定を追加（空でもOK）
  turbopack: {
    // PDF.js用の設定はTurbopackでは不要
  },
  
  // webpackの設定は残すが、Turbopack使用時は無視される
  webpack: (config, { isServer }) => {
    // PDF.js用の設定
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    // PDF.jsWorkerのURLを正しく解決するための設定
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;