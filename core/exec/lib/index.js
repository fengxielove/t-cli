import { resolve } from 'path'

import { Package } from '@t-cli/package'
import npmlog from '@t-cli/log'
// import { execSync } from '@t-cli/utils'

const SETTINGS = {
	init: '@t-cli/init'
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
	npmlog.info('入口代码地址', rootFile)
	if (rootFile) {
		try {
			const execFile = (await import(rootFile)).default
			if (typeof execFile === 'function') {
				// 执行入口文件的代码: 第一种 在当前进程中执行
				execFile.call(null, args)
				// 精简 args 中的数据 START
				// const cmd = args.at(-1)
				// const newObj = Object.create(null)
				// Object.keys(cmd).forEach((key) => {
				// 	if (
				// 		Object.prototype.hasOwnProperty.call(cmd, key) &&
				// 		!key.startsWith('_') &&
				// 		key !== 'parent'
				// 	) {
				// 		newObj[key] = cmd[key]
				// 	}
				// 	if (key === '_optionValues') {
				// 		newObj[key] = cmd[key]
				// 	}
				// })
				// newObj.getOptionValue = cmd.getOptionValue
				// args[args.length - 1] = newObj
				// 精简 args 中的数据 END
				// 第二种：在子进程中执行
				// const code = `(${execFile}).call(null, ${JSON.stringify(args)})`
				// await execSync('node', ['-e', code], {
				// 	stdio: 'inherit',
				// 	cwd: process.cwd()
				// })
			}
		} catch (error) {
			npmlog.error(error.message)
		}
	}
}
