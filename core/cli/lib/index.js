import semver from 'semver'
import chalk from 'chalk'
import rootCheck from 'root-check'
import userHome from 'userhome'
import { pathExistsSync } from 'path-exists'
import dotenv from 'dotenv'
import { Command } from 'commander'

import { resolve, join } from 'path'

import npmlog from '@t-cli/log'
import { DEFAULT_CLI_HOME, LOWEST_NODE_VERSION } from './const.js'
import { getNpmSemverVersion } from '@t-cli/get-npm-info'
import { exec } from '@t-cli/exec'

const program = new Command()

const pkg = await import('../package.json', {
	assert: { type: 'json' }
})

// 获取环境变量 dotenv
const checkEnv = () => {
	const dotEnvPath = resolve(userHome(), '.env')
	if (pathExistsSync(dotEnvPath)) {
		dotenv.config({
			path: dotEnvPath
		})
	}
	createDefaultConfig()
}

//  设置默认的环境变量位置
const createDefaultConfig = () => {
	const cliConfig = {
		home: userHome()
	}
	if (process.env.CLI_HOME) {
		cliConfig['cliHome'] = join(userHome(), process.env.CLI_HOME)
	} else {
		cliConfig['cliHome'] = join(userHome(), DEFAULT_CLI_HOME)
	}
	process.env.CLI_HOME_PATH = cliConfig['cliHome']
}

// 检查版本号
const checkPkgVersion = () => {
	npmlog.info('cli', pkg.default.version)
}

// 检查node版本号
const checkNodeVersion = () => {
	const currentVersion = process.version
	const lowestVersion = LOWEST_NODE_VERSION
	if (!semver.gte(currentVersion, lowestVersion)) {
		throw new Error(
			chalk.red(`tom 需要安装 v${lowestVersion} 以上版本的 Node.js`)
		)
	}
}

// 检查 root 启动
const checkRoot = () => {
	rootCheck()
}

// 检查用户主目录
const checkUserHome = () => {
	if (!userHome() || !pathExistsSync(userHome())) {
		throw new Error(chalk.red('当前登录用户主目录不存在！'))
	}
}

// 检查脚手架版本号
const checkGlobalUpdate = async () => {
	//     1. 获取当前版本号和模块名
	const currentVersion = pkg.default.version
	const npmName = pkg.default.name
	//     2. 调用 npm api，传递模块名，获取当前版本
	const lastVersion = await getNpmSemverVersion(currentVersion, npmName)
	//     3. 提取所有版本号，比对版本号提示更新
	if (lastVersion && semver.gt(lastVersion, currentVersion)) {
		npmlog.warn(
			'更新提示',
			chalk.yellow(`请手动更新 ${npmName}, 
        当前版本为 ${currentVersion}, 
            最新版本为${lastVersion}, 
                更新命令为 pnpm install ${npmName}`)
		)
	}
}

// 脚手架初始化阶段
// 注册命令
const registerCommand = () => {
	program
		.name(Object.keys(pkg.default.bin)[0])
		.usage('<command> [options]')
		.version(pkg.default.version)
		.option('-d, --debug', '是否开启调试模式', false)
		.option('-e, --envName <envName>', '获取环境变量名称')
		.option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '')

	program
		.command('init [projectName]')
		.option('-f, --force', '是否强制初始化项目')
		.action(exec)

	// 监听 debug
	program.on('option:debug', () => {
		if (program.getOptionValue('debug') === true) {
			process.env.LOG_LEVEL = 'verbose'
		} else {
			process.env.LOG_LEVEL = 'info'
		}
		npmlog.level = process.env.LOG_LEVEL
	})

	// 指定targetPath
	program.on('option:targetPath', () => {
		process.env.CLI_TARGET_PATH = program.getOptionValue('targetPath')
	})

	// 监听未知命令
	program.on('command:*', (obj) => {
		const availableCommands = program.commands.map((cmd) => cmd.name())
		console.log(chalk.red('未知命令:' + obj[0]))
		console.log(chalk.red('可用命令:' + availableCommands.join(',')))
	})

	// if (program.args && program.args.length < 1) {
	//     program.outputHelp()
	//     console.log()
	// }
	program.parse(process.argv)
}

const prepare = async () => {
	checkPkgVersion()
	checkNodeVersion()
	checkRoot()
	checkUserHome()
	checkEnv()
	// await checkGlobalUpdate()
}

export const core = async () => {
	try {
		await prepare()
		registerCommand()
	} catch (error) {
		npmlog.warn('error', error.message)
		if (process.env.LOG_LEVEL === 'verbose') {
			console.log('异常捕获', error)
		}
	}
}
