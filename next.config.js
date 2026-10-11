/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ['pg'] },
};