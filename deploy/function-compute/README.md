# Alibaba Cloud Function Compute deployment

This deployment uses Function Compute 3.0 in `ap-southeast-1` with an
anonymous HTTP trigger. The application runs as a Next.js standalone custom
runtime on port 9000. Qwen credentials are injected at deployment time and are
never committed.

## Package

1. Run `npm ci` and `npm run build` with Node.js 20.
2. Copy `.next/standalone/*` to `.fc-package/`.
3. Copy `.next/static` to `.fc-package/.next/static`.
4. Copy `public` to `.fc-package/public`.
5. Place a Node.js 20 binary at `.fc-package/.node/bin/node`.

## Deploy

Set `DASHSCOPE_API_KEY` in the shell environment and run:

```sh
s deploy -t deploy/function-compute/s.yaml -y
```

The service is intentionally configured with no provisioned concurrency, so
idle compute consumption is zero. Monitor the Function Compute trial quota and
remove the function after judging if it is no longer needed.
