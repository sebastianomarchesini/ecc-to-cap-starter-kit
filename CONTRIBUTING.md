# Contributing

Ran the kit against your own landscape? Open an issue and tell me what broke. That is how the kit gets better.

## Before you paste anything

Logs, `$metadata` files and screenshots from a real system usually identify it. Before posting, remove:

- host names, IP addresses and ports (look inside `__metadata.uri` and `atom:link` too);
- client numbers, system IDs and destination URLs;
- user names and e-mail addresses.

The same applies to pull requests: never commit `default-env.json`, and run `npm run strip-metadata` on any `$metadata` you add. CI rejects both.

## Issues

- **Something broke**: what you did, what you expected, what happened, and where (mock mode, BAS against ECC, or deployed).
- **Field report**: you ran the kit on your system. Say what you had to change and what would have saved you time.

## Pull requests

Keep them small and focused. Before opening one:

```sh
npm ci
npm test
npx cds build --production
```

The kit is deliberately minimal: five lines of CDS and one line of JavaScript are the point. Improvements to the docs, the tests and the traps are the most welcome. New features belong in a fork, or in a discussion first.

By contributing you agree that your contribution is licensed under the Apache License 2.0, like the rest of the code.
