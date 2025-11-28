import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Smart backend URL resolution (same logic as page.tsx)
    const backendUrl = 
      process.env.NEXT_PUBLIC_BACKEND_URL || 
      process.env.NEXT_PUBLIC_API_BASE_URL || 
      (process.env.NODE_ENV === "production" 
        ? "https://autonote-backend.up.railway.app"  // Railway production
        : "http://localhost:8000");                   // Local development
    
    return [
      {
        source: "/storage/:path*",
        destination: `${backendUrl}/storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
