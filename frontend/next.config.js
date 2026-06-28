/** @type {import('next').NextConfig} */
const nextConfig = {
  // csprclick-ui is built on styled-components; this compiler flag is what
  // makes its styles render correctly during SSR instead of flashing
  // unstyled on first paint.
  compiler: {
    styledComponents: true,
  },
};

module.exports = nextConfig;
