#! /usr/bin/env node --no-warnings
import importLocal from 'import-local';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { core } from "../lib/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (importLocal(__filename)) {

} else {
    await core()
}
