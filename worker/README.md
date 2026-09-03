# Content worker

Runs the long jobs the UGC content engine cannot do inside a Vercel function:
image generation, video rendering, publishing and analytics sync. A render is
minutes of CPU and needs FFmpeg on disk, so it cannot live in a request-time
serverless function.

## How it works

It polls `generation_jobs` in the same Postgres database the site uses, claiming
one row at a time with `SELECT ... FOR UPDATE SKIP LOCKED`. Several workers can
run concurrently without coordinating. A worker that crashes mid-job leaves its
row claimed, and the row becomes claimable again once the lease expires, so no
job is lost to a restart.

There is no inbound HTTP surface. The worker only makes outbound calls, so
there is no endpoint to authenticate or expose.

## Environment

    POSTGRES_URL                 same database as the site
    ANTHROPIC_API_KEY            scripts, captions, concepts
    OPENAI_API_KEY               stills and voice-over
    SUPABASE_URL                 object storage
    SUPABASE_SERVICE_ROLE_KEY    object storage
    CONTENT_BUCKET               defaults to "content"
    WORKER_ID                    optional, defaults to the hostname
    WORKER_DRY_RUN               when "1", publish jobs log instead of posting

## Deploying

Any container host works. Fly.io is the intended target: persistent machines
suit bursty render work better than per-request billing, and it can scale to
zero between batches.

    fly launch --no-deploy
    fly secrets set POSTGRES_URL=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
    fly deploy

## Safety

`WORKER_DRY_RUN=1` makes publish jobs log exactly what they would send and mark
the publication as `exported`, without calling any platform API. Leave it on
until a live post has been explicitly authorised.
