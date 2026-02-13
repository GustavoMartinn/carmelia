<p align="center">
  <img src="assets/icon.png" alt="carmelia" width="120" />
</p>

<h1 align="center">carmelia</h1>

<p align="center">
  <strong>The HTTP client that reads your code.</strong><br/>
  A desktop app that scans your API source code, generates ready-to-run HTTP requests, and executes them — all in one place.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#supported-frameworks">Frameworks</a> &bull;
  <a href="#features">Features</a>
</p>

---

## The Problem

You write your API, then **rewrite everything manually** in your HTTP client. Every route, every body, every param — duplicated.

When your API changes, your requests are instantly out of date.

## The Solution

**carmelia** is a desktop app that reads your source code and generates `.http` request files automatically — with correct paths, methods, bodies, and params. Edit and execute them directly in the app. When your code changes, hit sync and everything updates.

## Quick Start

### Download & Build

```bash
git clone https://github.com/your-user/carmelia.git
cd carmelia/carmelia-desktop
npm install --prefix frontend
wails build
```

The built binary will be at `build/bin/carmelia`. Run it to open the app.

### First Use

1. Open carmelia
2. Click **Open Project** and select your API project folder
3. Click **Sync** — carmelia scans your code and generates requests
4. Browse the file tree, select a request, edit if needed, and hit **Send**

## How It Works

### 1. Open your project

Point carmelia to any API project — it auto-detects the framework from `package.json` or `go.mod`.

### 2. Scan

carmelia analyzes your source code and detects routes, methods, path params, body types, auth requirements, and validation rules. It generates organized `.http` files:

```
.carmelia/
  config.yaml
  envs/
    local.yaml
  requests/
    users/
      create-user.http
      get-user.http
      list-users.http
    auth/
      login.http
```

Example generated request:

```http
# Source: src/users/users.controller.ts:24
# DTO: CreateUserDto

POST {{base_url}}/api/users
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "name": "string",
  "email": "string",
  "age": 0,
  "role": "USER | ADMIN"
}
```

### 3. Edit & Execute

Edit the request body directly in the app's code editor, select your environment (local, staging, production), and send. The response shows up instantly with status, headers, body, and timing.

### 4. Sync

When your code changes, hit sync. carmelia re-scans and updates requests without overwriting your manual edits:

- New endpoints get new files
- Removed endpoints get flagged
- Changed bodies get updated, preserving your custom values

## Supported Frameworks

| Framework | Language | What It Reads |
|-----------|----------|---------------|
| **NestJS** | TypeScript | `@Controller`, `@Get/@Post/...`, `@Body()` DTOs, `@UseGuards`, class-validator decorators |
| **Express** | TypeScript | `router.get()/.post()/...`, `app.use()` mounts, Zod schemas, TypeScript body types |
| **Go** | Go | chi, gin, fiber, echo, net/http route registration, request structs with json tags, validate tags |

Framework detection is automatic.

## Features

- **Code-aware scanning** — reads your actual source code, not OpenAPI specs
- **Multi-framework** — NestJS, Express, and Go (chi, gin, fiber, echo, net/http) on day one
- **Desktop app** — visual file tree, code editor with syntax highlighting, one-click execution
- **Environment management** — switch between local, staging, production with variables
- **Multi-project tabs** — work on multiple APIs simultaneously
- **Smart sync** — re-scans your code and merges changes without losing your edits
- **Git-friendly** — everything in plain text, reviewable in PRs

## Environments

Configure variables per environment in `.carmelia/envs/`:

```yaml
# .carmelia/envs/local.yaml
base_url: http://localhost:3000
token: dev-token-here

# .carmelia/envs/staging.yaml
base_url: https://staging-api.example.com
token: ${STAGING_TOKEN}  # reads from system env var
```

Switch environments in the app's top bar.

## Development

```bash
cd carmelia-desktop
wails dev    # development with hot reload
wails build  # production build
```

The scanning engine lives in the root project (TypeScript/Node) and is called by the desktop app to parse source code.

## Why Not...

| Tool | Limitation |
|------|-----------|
| **Postman** | Bloatware, cloud-dependent, doesn't read your code |
| **Insomnia** | Acquired and degraded, same problem |
| **HTTPie** | No persistence, no code scanning |
| **VS Code REST Client** | Editor-locked, no CI, no code scanning |
| **Bruno** | Closest alternative, but doesn't read source code |
| **curl** | Terrible syntax for anything beyond GET |

**None of them read your code and generate requests automatically.** That's what carmelia does.

## License

MIT
