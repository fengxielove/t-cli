import semver from 'semver'
import chalk from 'chalk'
import npmlog from '@t-cli/log'

export const LOWEST_NODE_VERSION = '18.0.0'

class Command {
	constructor(argv) {
		if (!argv) {
			throw new Error('参数不能为空')
		}
		if (!Array.isArray(argv)) {
			throw new Error('参数必须为数组')
		}
		if (argv.length < 1) {
			throw new Error('参数列表为空')
		}
		this._argv = argv
		new Promise((resolve, reject) => {
			let chain = Promise.resolve()
			chain = chain.then(() => this.checkNodeVersion())
			chain = chain.then(() => this.initArgs())
			chain = chain.then(() => this.init())
			chain = chain.then(() => this.exec())
			chain.catch((err) => {
				npmlog.error(err.message)
			})
		})
	}

	// 检查node版本号
	checkNodeVersion() {
		const currentVersion = process.version
		const lowestVersion = LOWEST_NODE_VERSION
		if (!semver.gte(currentVersion, lowestVersion)) {
			throw new Error(
				chalk.red(`@t-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`)
			)
		} else {
			npmlog.info(
				`node版本检查：✅ -- 当前版本${currentVersion},最低要求${lowestVersion}`
			)
		}
	}

	// 参数检查
	initArgs() {
		this._cmd = this._argv.at(-1)
		this._argv = this._argv.slice(0, this._argv.length - 1)
	}

	init() {
		throw new Error('init 必须实现')
	}

	exec() {
		throw new Error('exec 必须实现')
	}
}

export default Command
