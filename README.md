<p align="center">
  <img src="assets/icon.png" alt="carmelia" width="120" />
</p>

<h1 align="center">carmelia</h1>

<p align="center">
  <strong>The HTTP client that reads your code.</strong><br/>
  Scans your API source code, generates ready-to-run HTTP requests, and executes them — all in one desktop app.
</p>

<p align="center">
  <a href="https://github.com/GustavoMartinn/carmelia/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/go-1.23-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/wails-v2.11-red" alt="Wails" />
  <img src="https://img.shields.io/badge/platform-linux%20%7C%20macos%20%7C%20windows-lightgrey" alt="Platform" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#supported-frameworks">Frameworks</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#development">Development</a>
</p>

---

## The Problem

You write your API, then **rewrite everything manually** in your HTTP client. Every route, every body, every param — duplicated.

When your API changes, your requests are instantly out of date.

## The Solution

**carmelia** reads your source code and generates `.http` request files automatically — with correct paths, methods, bodies, and params. Edit and execute them directly in the app. When your code changes, hit sync and everything updates.

## Quick Start

### Install (Linux .deb)

Download the latest `.deb` from [Releases](https://github.com/GustavoMartinn/carmelia/releases) and install:

```bash
sudo dpkg -i carmelia_0.1.0_amd64.deb
```

### Build from source

```bash
git clone https://github.com/GustavoMartinn/carmelia.git
cd carmelia
npm install --prefix frontend
wails build
```

The binary will be at `build/bin/carmelia`.

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

Edit the request body in the built-in code editor, select your environment, and send. The response shows up instantly with status, headers, body, and timing.

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

### Core

- **Code-aware scanning** — reads your actual source code, not OpenAPI specs
- **Multi-framework** — NestJS, Express, and Go (chi, gin, fiber, echo, net/http)
- **Smart sync** — re-scans your code and merges changes without losing your edits
- **Git-friendly** — everything stored as plain `.http` and `.yaml` files, reviewable in PRs

### Editor

- **Tabbed editor** — query params, headers, body, raw `.http`, variables, auth, and docs
- **Syntax highlighting** — CodeMirror 6 with HTTP and JSON support
- **Auth presets** — Bearer, Basic, and API Key (header or query param)
- **Local variables** — per-request variable overrides that don't pollute your environment
- **cURL import** — paste a cURL command and carmelia converts it to a `.http` file

### Response

- **Formatted response** — body (with syntax highlighting), headers, cookies, raw view
- **Response history** — automatically saves the last N responses per request
- **Diff viewer** — compare two response bodies side-by-side

### Workspace

- **Multi-project tabs** — work on multiple APIs simultaneously
- **Session persistence** — restores open projects and tabs on restart
- **Playground mode** — quick testing without opening a project
- **File tree** — create, delete, and organize request files and folders

### Environment Management

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

### Export

Export your collections to other tools:

- **Postman** Collection v2.1
- **Insomnia** v4
- **OpenAPI** 3.0

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send request |
| `Ctrl+S` | Save current file |

## Why Not...

| Tool | Limitation |
|------|-----------|
| **Postman** | Bloatware, cloud-dependent, doesn't read your code |
| **Insomnia** | Acquired and degraded, same problem |
| **HTTPie** | No persistence, no code scanning |
| **VS Code REST Client** | Editor-locked, no code scanning |
| **Bruno** | Closest alternative, but doesn't read source code |
| **curl** | Terrible syntax for anything beyond GET |

**None of them read your code and generate requests automatically.** That's what carmelia does.

## Development

### Prerequisites

- [Go 1.23+](https://golang.org/dl/)
- [Node.js 18+](https://nodejs.org/)
- [Wails v2](https://wails.io/docs/gettingstarted/installation)

### Run in dev mode

```bash
npm install --prefix frontend
wails dev -tags webkit2_41   # hot reload for both Go and React
```

### Build

```bash
wails build -tags webkit2_41
```

### Package (.deb)

```bash
# install nfpm (one time)
go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest

# build and package
wails build -tags webkit2_41
nfpm package --packager deb --target .
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Wails v2](https://wails.io) |
| Backend | Go 1.23 |
| Frontend | React 18, TypeScript, Vite |
| State management | Zustand |
| Code editor | CodeMirror 6 |
| Styling | Tailwind CSS 4 |
| Packaging | nfpm |

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a PR.

```bash
git clone https://github.com/GustavoMartinn/carmelia.git
cd carmelia
npm install --prefix frontend
wails dev -tags webkit2_41
```

## License

[MIT](LICENSE)
