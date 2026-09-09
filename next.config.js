/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/dashboard", destination: "/animals/dashboard", permanent: false },
      { source: "/farms", destination: "/animals/farms", permanent: false },
      { source: "/units", destination: "/animals/units", permanent: false },
      { source: "/species-breeds", destination: "/animals/species-breeds", permanent: false },
      { source: "/animals", destination: "/animals/list", permanent: false },
      { source: "/milk-production", destination: "/animals/milk-production", permanent: false },
      { source: "/vaccinations", destination: "/animals/vaccinations", permanent: false },
      { source: "/breeding", destination: "/animals/breeding", permanent: false },
      { source: "/heat-cycles", destination: "/animals/heat-cycles", permanent: false },
      { source: "/pregnancy", destination: "/animals/pregnancy", permanent: false },
      { source: "/calving", destination: "/animals/calving", permanent: false },
      { source: "/inventory", destination: "/inventory/dashboard", permanent: false },
      { source: "/animals/inventory", destination: "/inventory/dashboard", permanent: false },
      {
        source: "/animals/:id(\\d+)",
        destination: "/animals/list/:id",
        permanent: false,
      },
    ];
  },
};
module.exports = nextConfig;
