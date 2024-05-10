import { resolve } from 'path'
import { spawnSync, spawn } from 'child_process'

import { Package } from '@t-cli/package'
import npmlog from '@t-cli/log'

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

				// 第二种：在子进程中执行
				// const child = cSpawn('node', ['-e', execFile, args], {
				// 	cwd: process.cwd(),
				// 	stdio: 'inherit'
				// })
				// child.on('error', (error) => {
				// 	npmlog.error(error.message)
				// })
				//
				// child.on('exit', (info) => {
				// 	npmlog.verbose('命令执行成功', info)
				// 	process.exit(info)
				// })
			}
		} catch (error) {
			npmlog.error(error.message)
		}
	}
}

/**
 * 自定义  cSpawn 函数，处理操作系统间的差异性
 * @param command
 * @param args
 * @param options
 */
const cSpawn = (command, args, options) => {
	// 判断是否是 windows 操作系统
	const win32 = process.platform === 'win32'
	const cmd = win32 ? 'cmd' : command
	const cmdArgs = win32 ? ['/c'].concat(command, args) : args
	return spawn(cmd, cmdArgs, options || {})
}
