import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://epam-acme-corp.github.io',
  base: '/telco-docs',
  integrations: [
    starlight({
      title: 'Acme Telco Docs',
      components: {
        SiteTitle: './src/components/OPCOSelector.astro',
      },
      sidebar: [
        {
          label: 'Overview',
          autogenerate: { directory: 'overview' },
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Architecture Overview', slug: 'architecture/overview' },
            {
              label: 'ADRs',
              autogenerate: { directory: 'architecture/adr' },
            },
          ],
        },
        {
          label: 'Technical',
          autogenerate: { directory: 'technical' },
        },
        {
          label: 'API',
          autogenerate: { directory: 'api' },
        },
        {
          label: 'Data',
          autogenerate: { directory: 'data' },
        },
        {
          label: 'Security',
          autogenerate: { directory: 'security' },
        },
      ],
    }),
  ],
});
