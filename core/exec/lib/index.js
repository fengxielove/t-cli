import { resolve } from 'path'
import { Package } from '@t-cli/package'
import npmlog from '@t-cli/log'

const SETTINGS = {
	// init: '@t-cli/init'
	init: '@imooc-cli/init'
}

const CACHE_DIR = 'test-dependencies'
/**
 * 1. targetPath -> modulePath
 * 2. modulePath -> Package(npm模块)
 * 3. Package.getRootFile() 获取入口文件
 * 4. 执行入口文件
 */
export const exec = async (...args) => {
	let targetPath = process.env.CLI_TARGET_PATH
	let storeDir = ''
	let pkg = null
	const homePath = process.env.CLI_HOME_PATH
	const cmdObj = args.at(-1)
	const cmdName = cmdObj.name()
	const packageName = SETTINGS[cmdName]
	const packageVersion = 'latest'

	if (!targetPath) {
		targetPath = resolve(homePath, CACHE_DIR) // 	生成缓存路径
		storeDir = resolve(targetPath, 'node_modules')

		pkg = new Package({
			targetPath,
			storeDir,
			packageName,
			packageVersion
		})
		npmlog.verbose('pkg', pkg)

		if (await pkg.exists()) {
			// 	更新 package
			console.log('更新 package')
			await pkg.update()
		} else {
			// 	安装 package
			await pkg.install()
		}
	} else {
		pkg = new Package({
			targetPath,
			packageName,
			packageVersion
		})
		npmlog.verbose('pkg', pkg)
	}

	const rootFile = await pkg.getRootFilePath()
	console.log('rootFile', rootFile)
	if (rootFile) {
		const execFile = (await import(rootFile)).default
		if (typeof execFile === 'function') {
			execFile.apply(null, args)
		}
	}
}
