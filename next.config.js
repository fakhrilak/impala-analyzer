/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ['pg'] },
};
