// Regenerates src/lib/database.types.ts from the live schema.
import { writeFile } from 'node:fs/promises'
import { api } from './lib.mjs'

const { types } = await api('/types/typescript?included_schemas=public')
await writeFile(new URL('../src/lib/database.types.ts', import.meta.url), types)
console.log('src/lib/database.types.ts mis à jour')
