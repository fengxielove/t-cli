import Command from '@t-cli/command'
import npmlog from '@t-cli/log'

export class InitCommand extends Command {
	init() {
		this.projectName = this._argv[0] || ''
		this.force = !!this._cmd.getOptionValue('force')
		npmlog.verbose('projectName', this.projectName)
		npmlog.verbose('force', this.force)
	}

	exec() {}
}

/**
 * 默认导出 init 初始化的执行函数，在入口文件那里动态导入执行
 */
const init = (args) => {
	console.log('init 业务逻辑')
	return new InitCommand(args)
}

export default init
