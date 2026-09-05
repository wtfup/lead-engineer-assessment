export default {
  poweredByHeader: false,
  async rewrites() { return [{ source: '/api/:path*', destination: 'http://127.0.0.1:4318/api/:path*' }]; },
};
