#! /usr/bin/env node --no-warnings
import importLocal from 'import-local'
import { fileURLToPath } from 'url'
import { core } from '../lib/index.js'

const __filename = fileURLToPath(import.meta.url)

if (importLocal(__filename)) {
} else {
	await core()
}
