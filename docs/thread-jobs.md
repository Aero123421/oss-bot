# Thread background jobs: local fixture proof

This initial API supports one predefined local job, `fixture_check`. It runs
three fixed checks in the API process and returns `{"checked":3}`. It accepts
no commands, inputs for the checks, file paths, provider selection, credentials,
or external actions. It does not send messages into the chat or use its stream.
Use synthetic data when exercising this proof.

## API

All routes use the existing shared-token API gate. The thread in the path scopes
the lookup; a job ID from a different thread returns 404. There is no new
per-user or per-thread authorization beyond the existing shared token.

| Method | Path relative to `/api/v1/threads/:threadId` | Response |
| --- | --- | --- |
| POST | `/jobs` | 201 `{"job":…}` on creation, 200 for an existing request key, or 409 if a different job is already active in the thread |
| GET | `/jobs` | 200 `{"jobs":[…]}`, latest 20 |
| GET | `/jobs/:jobId` | 200 `{"job":…}` |
| POST | `/jobs/:jobId/cancel` | 200 with the terminal record; if already finished, returns the existing result and status unchanged |

Submit with JSON:

```json
{"kind":"fixture_check","requestKey":"sample_request_01"}
```

Use one request key per intended run and reuse it on retries. Keys are scoped to
a thread and contain 1 to 80 ASCII letters, digits, underscores, or hyphens. The
body has no other fields and is capped at 1 KiB. Poll the submitted job ID or
reopen the thread's job list without creating a new run. No provider is needed.

## Persistence and limitations

Status is `queued`, `running`, `succeeded`, `failed`, `cancelled`, or
`interrupted`. The API stores one result per successful job, atomically in the
same SQLite record as the terminal status. Cancel and finish only change an
active job; when one wins, a later transition cannot replace it. Cancellation
prevents result publication. It does not stop external work: this fixture has
none, and its pure delayed check may still finish internally.

Run only one API process for a SQLite database. If it restarts, jobs still queued
or running become `interrupted` (`process_restarted`) instead of being resumed
or retried automatically. Finished records and their IDs are preserved. A
repeat submission with the interrupted job's key returns that same record.
To deliberately run the fixture again, submit with a new key.

Run the isolated API contract test with:

```sh
node --import tsx --test tests/thread-jobs.test.ts
```
