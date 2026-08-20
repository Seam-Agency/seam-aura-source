# Contributing

## Local setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run check
npm run test:browser
npm run smoke:consumer
npm pack --dry-run
```

Keep the component API framework-neutral beyond its React boundary, preserve reduced-motion behavior, and do not commit raw production captures, bundles, credentials, source maps, or customer assets.
