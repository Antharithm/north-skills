{
  "name": "{{PROJECT_NAME}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "start": "tsx --env-file=.env src/server.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^5.2.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/node": "^22.20.5",
    "tsx": "^4.23.15",
    "typescript": "^5.9.3"
  }
}
